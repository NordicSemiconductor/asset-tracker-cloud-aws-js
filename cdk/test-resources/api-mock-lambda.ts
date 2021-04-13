import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
	DeleteMessageCommand,
	MessageAttributeValue,
	ReceiveMessageCommand,
	SendMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs'
const sqs = new SQSClient({})
import * as querystring from 'querystring'

export const handler = async (
	event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	const path = `${event.path.replace(/^\//, '')}${
		event.queryStringParameters !== null &&
		event.queryStringParameters !== undefined
			? `?${querystring.stringify(event.queryStringParameters)}`
			: ''
	}`

	const MessageAttributes = {
		method: {
			DataType: 'String',
			StringValue: event.httpMethod,
		},
		path: {
			DataType: 'String',
			StringValue: path,
		},
		...Object.keys(event.headers)
			.filter((key) => !/^(CloudFront-|X-|Host|Via)/.test(key))
			.slice(0, 8) // max number of MessageAttributes is 10
			.reduce(
				(hdrs, key) => ({
					...hdrs,
					[key]: {
						DataType: 'String',
						StringValue: event.headers[key] ?? '',
					},
				}),
				{} as {
					[key: string]: MessageAttributeValue
				},
			),
	}

	await sqs.send(
		new SendMessageCommand({
			MessageBody: event.body ?? '{}',
			MessageAttributes,
			QueueUrl: process.env.SQS_REQUEST_QUEUE,
			MessageGroupId: path, // Use the path to group messages, so multiple consumers can use the mock API
			MessageDeduplicationId: event.requestContext.requestId,
		}),
	)

	// Check if response exists
	await new Promise((resolve) => setTimeout(resolve, 1000 * 2)) // Wait for visibility timeout of other requests
	console.log(`Checking if response exists for ${event.httpMethod} ${path}...`)
	const { Messages } = await sqs.send(
		new ReceiveMessageCommand({
			QueueUrl: process.env.SQS_RESPONSE_QUEUE,
			MessageAttributeNames: ['statusCode', 'method', 'path'],
			WaitTimeSeconds: 0,
			MaxNumberOfMessages: 10,
			VisibilityTimeout: 1,
		}),
	)
	if (Messages !== undefined) {
		for (const msg of Messages) {
			console.log(JSON.stringify(msg))
			if (
				msg.MessageAttributes?.method?.StringValue === event.httpMethod &&
				msg.MessageAttributes?.path?.StringValue === path
			) {
				console.log('match')
				await sqs.send(
					new DeleteMessageCommand({
						QueueUrl: process.env.SQS_RESPONSE_QUEUE,
						ReceiptHandle: msg.ReceiptHandle,
					}),
				)
				return {
					statusCode: parseInt(
						msg.MessageAttributes?.statusCode?.StringValue ?? '200',
						10,
					),
					body: msg.Body ?? '',
				}
			} else {
				console.log('no match')
			}
		}
	} else {
		console.log('no responses found')
	}

	return { statusCode: 404, body: '' }
}
