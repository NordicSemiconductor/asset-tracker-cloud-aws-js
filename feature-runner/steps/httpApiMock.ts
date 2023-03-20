import {
	AttributeValue,
	DeleteItemCommand,
	DynamoDBClient,
	PutItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import {
	regexGroupMatcher,
	type InterpolatedStep,
	type StepRunnerFunc,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import chai, { expect } from 'chai'
import chaiSubset from 'chai-subset'
import { splitMockResponse } from '../../cdk/test-resources/splitMockResponse.js'
import type { AssetTrackerWorld } from '../run-features.js'
chai.use(chaiSubset)

export const httpApiMockStepRunners = ({
	db,
}: {
	db: DynamoDBClient
}): ((
	step: InterpolatedStep,
) => StepRunnerFunc<AssetTrackerWorld> | false)[] => {
	return [
		regexGroupMatcher<AssetTrackerWorld>(
			/^I enqueue this mock HTTP API response with status code (?<statusCode>[0-9]+) for a (?<method>[A-Z]+) request to (?<path>.+)$/,
		)(async ({ statusCode, method, path }, step, runner) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			await db.send(
				new PutItemCommand({
					TableName: runner.world['httpApiMock:responsesTableName'],
					Item: {
						methodPathQuery: {
							S: `${method} ${path}`,
						},
						statusCode: {
							N: statusCode as string,
						},
						body: {
							S: step.interpolatedArgument,
						},
						ttl: {
							N: `${Math.round(Date.now() / 1000) + 5 * 60}`,
						},
					},
				}),
			)
		}),
		regexGroupMatcher<AssetTrackerWorld>(
			/^the mock HTTP API should have been called with a (?<method>[A-Z]+) request to (?<path>.+)$/,
		)(async ({ method, path }, step, runner) => {
			let expectedBody: Record<string, any> | undefined = undefined
			let expectedHeaders: Record<string, string> | undefined = undefined
			if (step.interpolatedArgument !== undefined) {
				const { body, headers } = splitMockResponse(step.interpolatedArgument)
				expectedBody = JSON.parse(body)
				expectedHeaders = headers
			}

			const res = await db.send(
				new QueryCommand({
					TableName: runner.world['httpApiMock:requestsTableName'],
					KeyConditionExpression: 'methodPathQuery = :methodPathQuery',
					ExpressionAttributeValues: {
						[':methodPathQuery']: {
							S: `${method} ${path}`,
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
						expect(actual).to.deep.equal(expectedBody)
					}
					if (expectedHeaders !== undefined) {
						const actual = JSON.parse(request.headers?.S ?? '{}')
						expect(actual).to.containSubset(expectedHeaders)
					}
					await db.send(
						new DeleteItemCommand({
							TableName: runner.world['httpApiMock:requestsTableName'],
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
		}),
	]
}
