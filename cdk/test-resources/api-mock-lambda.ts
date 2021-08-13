import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
	DeleteItemCommand,
	DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import * as querystring from 'querystring'
import { v4 } from 'uuid'
import { splitMockResponse } from './splitMockResponse'

const db = new DynamoDBClient({})

export const handler = async (
	event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	const pathWithQuery = `${event.path.replace(/^\//, '')}${
		event.queryStringParameters !== null &&
		event.queryStringParameters !== undefined
			? `?${querystring.stringify(event.queryStringParameters)}`
			: ''
	}`

	await db.send(
		new PutItemCommand({
			TableName: process.env.REQUESTS_TABLE_NAME,
			Item: {
				methodPathQuery: {
					S: `${event.httpMethod} ${pathWithQuery}`,
				},
				requestId: {
					S: v4(),
				},
				method: {
					S: event.httpMethod,
				},
				path: {
					S: pathWithQuery,
				},
				body: {
					S: event.body ?? '{}',
				},
				headers: {
					S: JSON.stringify(event.headers),
				},
				ttl: {
					N: `${Math.round(Date.now() / 1000) + 5 * 60}`,
				},
			},
		}),
	)

	// Check if response exists
	console.log(
		`Checking if response exists for ${event.httpMethod} ${pathWithQuery}...`,
	)
	const { Item } = await db.send(
		new GetItemCommand({
			TableName: process.env.RESPONSES_TABLE_NAME,
			Key: {
				methodPathQuery: {
					S: `${event.httpMethod} ${pathWithQuery}`,
				},
			},
		}),
	)
	if (Item !== undefined) {
		console.log(JSON.stringify(Item))
		await db.send(
			new DeleteItemCommand({
				TableName: process.env.RESPONSES_TABLE_NAME,
				Key: {
					methodPathQuery: {
						S: `${event.httpMethod} ${pathWithQuery}`,
					},
				},
			}),
		)

		const res = {
			statusCode: parseInt(Item.statusCode.N ?? '200', 10),
			...splitMockResponse(Item.body.S ?? ''),
		}
		console.log(JSON.stringify(res))

		return res
	} else {
		console.log('no responses found')
	}

	return { statusCode: 404, body: '' }
}
