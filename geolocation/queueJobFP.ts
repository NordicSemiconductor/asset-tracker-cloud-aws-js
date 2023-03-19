import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo.js'

/**
 * @deprecated use queueJob() because fp-ts is getting gradually phased out from this code-base
 */
export const queueJobFP =
	({ sqs, QueueUrl }: { sqs: SQSClient; QueueUrl: string }) =>
	({
		payload,
		deduplicationId,
	}: {
		payload: unknown
		deduplicationId: string
	}): TE.TaskEither<ErrorInfo, void> =>
		TE.tryCatch(
			async () => {
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
			},
			(err) => {
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
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		)
