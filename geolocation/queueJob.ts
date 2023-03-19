import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo.js'

export const queueJob =
	({ sqs, QueueUrl }: { sqs: SQSClient; QueueUrl: string }) =>
	async ({
		payload,
		deduplicationId,
		delay,
	}: {
		payload: unknown
		deduplicationId?: string
		delay?: number
	}): Promise<{ error: ErrorInfo } | void> => {
		try {
			console.debug(
				JSON.stringify({
					queueJob: {
						payload,
					},
				}),
			)
			const { MessageId, SequenceNumber } = await sqs.send(
				new SendMessageCommand({
					QueueUrl,
					MessageBody: JSON.stringify(payload),
					MessageGroupId: deduplicationId,
					MessageDeduplicationId: deduplicationId,
					DelaySeconds: delay,
				}),
			)
			console.debug(
				JSON.stringify({
					queueJob: {
						QueueUrl,
						MessageId,
						SequenceNumber,
					},
				}),
			)
		} catch (err) {
			console.error(
				JSON.stringify({
					queueJob: {
						error: (err as Error).message,
						cell: payload,
						QueueUrl,
					},
				}),
			)
			return {
				error: {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				},
			}
		}
	}
