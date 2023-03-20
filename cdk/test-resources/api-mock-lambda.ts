import {
	DeleteItemCommand,
	DynamoDBClient,
	GetItemCommand,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import type { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import querystring from 'querystring'
import { splitMockResponse } from './splitMockResponse.js'

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
					S: randomUUID(),
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

		const { body, headers } = splitMockResponse(Item.body?.S ?? '')

		// Send as binary, if mock response is HEX encoded. See https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html
		const isBinary = /^[0-9a-f]+$/.test(body)
		const res = {
			statusCode: parseInt(Item.statusCode?.N ?? '200', 10),
			headers: isBinary
				? {
						...headers,
						'Content-Type': 'application/octet-stream',
				  }
				: headers,
			body: isBinary
				? /* body is HEX encoded */ Buffer.from(body, 'hex').toString('base64')
				: body,
			isBase64Encoded: isBinary,
		}
		console.log(JSON.stringify(res))

		return res
	} else {
		console.log('no responses found')
	}

	return { statusCode: 404, body: '' }
}
