import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import {
	DeleteMessageCommand,
	MessageAttributeValue,
	ReceiveMessageCommand,
	SendMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs'
const sqs = new SQSClient({})

export const handler = async (
	event: APIGatewayEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	const MessageAttributes = {
		method: {
			DataType: 'String',
			StringValue: event.httpMethod,
		},
		path: {
			DataType: 'String',
			StringValue: event.path,
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
			MessageBody: event.body as string,
			MessageAttributes,
			QueueUrl: process.env.SQS_REQUEST_QUEUE,
			MessageGroupId: event.path, // Use the path to group messages, so multiple consumers can use the mock API
			MessageDeduplicationId: event.requestContext.requestId,
		}),
	)

	// Check if response exists
	console.log(
		`Checking if response exists for ${event.httpMethod} ${event.path.replace(
			/^\/prod/,
			'',
		)}...`,
	)
	const { Messages } = await sqs.send(
		new ReceiveMessageCommand({
			QueueUrl: process.env.SQS_RESPONSE_QUEUE,
			MessageAttributeNames: ['statusCode', 'method', 'path'],
			WaitTimeSeconds: 0,
			MaxNumberOfMessages: 10,
		}),
	)
	if (Messages !== undefined) {
		for (const msg of Messages) {
			if (
				msg.MessageAttributes?.method?.StringValue === event.httpMethod &&
				msg.MessageAttributes?.path?.StringValue ===
					event.path.replace(/^\/prod/, '')
			) {
				console.log('match')
				console.log(JSON.stringify(msg))
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
			}
		}
	}

	return { statusCode: 404, body: '' }
}
