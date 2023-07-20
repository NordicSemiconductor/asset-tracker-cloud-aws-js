import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import type { World } from '../run-features.js'
import { matchChoice, matchStep, matchString } from './util.js'
import {
	AttributeValue,
	DeleteItemCommand,
	DynamoDBClient,
	PutItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { splitMockResponse } from '../../cdk/test-resources/splitMockResponse.js'
import { check, objectMatching } from 'tsmatchers'

const stepArgs = Type.Object({
	method: Type.Union([
		Type.Literal('GET'),
		Type.Literal('POST'),
		Type.Literal('PUT'),
		Type.Literal('DELETE'),
		Type.Literal('HEAD'),
	]),
	resource: Type.String(),
})

const matchMethod = matchChoice('method', [
	'GET',
	'POST',
	'PUT',
	'DELETE',
	'HEAD',
])

const matchResource = matchString('resource')

const steps: (args: {
	db: DynamoDBClient
	requestsTableName: string
	responsesTableName: string
	apiURL: string
}) => StepRunner<World>[] = ({
	db,
	requestsTableName,
	responsesTableName,
	apiURL,
}) => [
	matchStep(
		new RegExp(
			`^I enqueue this mock HTTP API response for a ${matchMethod} request to ${matchResource}$`,
		),
		stepArgs,
		async (
			{ resource, method },
			{
				step,
				log: {
					step: { progress },
				},
			},
		) => {
			const url = new URL(resource, apiURL).toString()
			progress(`${method} ${url}`)
			const responseBody = codeBlockOrThrow(step)
			const body = responseBody.code

			let responseBodyAndHeaders = body
			if (responseBody.language === 'json') {
				const jsonBody = JSON.stringify(JSON.parse(responseBody.code))
				responseBodyAndHeaders = [
					`Content-type: application/json; charset=utf-8`,
					`Content-Length: ${jsonBody.length}`,
					``,
					`${jsonBody}`,
				].join('\n')
			}
			progress(responseBodyAndHeaders)
			await db.send(
				new PutItemCommand({
					TableName: responsesTableName,
					Item: {
						methodPathQuery: {
							S: `${method} ${resource}`,
						},
						statusCode: {
							N: `200`,
						},
						body: {
							S: responseBodyAndHeaders,
						},
						ttl: {
							N: `${Math.round(Date.now() / 1000) + 5 * 60}`,
						},
					},
				}),
			)
		},
	),
	matchStep(
		new RegExp(
			`^the mock HTTP API should have been called with a ${matchMethod} request to ${matchResource}$`,
		),
		stepArgs,
		async (
			{ method, resource },
			{
				step,
				log: {
					step: { progress },
				},
			},
		) => {
			let expectedBody: Record<string, any> | undefined = undefined
			let expectedHeaders: Record<string, string> | undefined = undefined

			if (step.codeBlock !== undefined) {
				const { body, headers } = splitMockResponse(step.codeBlock.code)
				expectedBody = JSON.parse(body)
				expectedHeaders = headers
				for (const [k, v] of Object.entries(expectedHeaders)) {
					progress(`${k}: ${v}`)
				}
				progress(body)
			}

			const res = await db.send(
				new QueryCommand({
					TableName: requestsTableName,
					KeyConditionExpression: 'methodPathQuery = :methodPathQuery',
					ExpressionAttributeValues: {
						[':methodPathQuery']: {
							S: `${method} ${resource}`,
						},
					},
					ProjectionExpression: 'methodPathQuery,requestId,body,headers',
					Limit: 1000,
				}),
			)
			const { Items } = res
			if (Items === undefined) throw new Error('No requests found!')
			for (const request of Items) {
				try {
					if (expectedBody !== undefined) {
						const actual = JSON.parse(request.body?.S ?? '{}')
						check(actual).is(objectMatching(expectedBody))
					}
					if (expectedHeaders !== undefined) {
						const actual = JSON.parse(request.headers?.S ?? '{}')
						check(actual).is(objectMatching(expectedHeaders))
					}
					await db.send(
						new DeleteItemCommand({
							TableName: requestsTableName,
							Key: {
								methodPathQuery: request.methodPathQuery as AttributeValue,
								requestId: request.requestId as AttributeValue,
							},
						}),
					)
					return
				} catch {
					// Ignore this, there could be multiple requests that do not match
				}
			}
			throw new Error('No requests matched.')
		},
	),
]

export default steps
