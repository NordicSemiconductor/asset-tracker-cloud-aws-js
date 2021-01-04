import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { Option, some, none } from 'fp-ts/lib/Option'

export type Cell = {
	area: number
	mccmnc: number
	cell: number
}

export type Location = {
	lat: number
	lng: number
	accuracy: number
}

export const geolocateCellFromCache = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => (
	cell: Cell,
): TE.TaskEither<
	ErrorInfo,
	Option<{ unresolved: boolean } & Partial<Location>>
> =>
	TE.tryCatch(
		async () => {
			const id = cellId(cell)
			const { Item } = await dynamodb.send(
				new GetItemCommand({
					TableName,
					Key: {
						cellId: {
							S: id,
						},
					},
					ProjectionExpression: 'lat,lng,accuracy,unresolved',
				}),
			)
			if (Item) {
				const unresolved = Item.unresolved?.BOOL ?? false
				if (unresolved) {
					return some({
						unresolved,
					})
				} else {
					return some({
						unresolved,
						lat: parseFloat(Item.lat.N as string),
						lng: parseFloat(Item.lng.N as string),
						accuracy:
							Item?.accuracy?.N !== undefined
								? parseFloat(Item.accuracy.N)
								: 5000,
					})
				}
			}

			return none
		},
		(err) => {
			const id = cellId(cell)
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return {
					type: ErrorType.EntityNotFound,
					message: `Cell ${id} not found!`,
				}
			console.error(
				JSON.stringify({
					geolocateCellFromCache: {
						err,
						cell,
						TableName,
					},
				}),
			)
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)

export const queueCellGeolocationResolutionJob = ({
	sqs,
	QueueUrl,
}: {
	sqs: SQSClient
	QueueUrl: string
}) => (cell: Cell): TE.TaskEither<ErrorInfo, void> =>
	TE.tryCatch(
		async () => {
			console.debug(
				JSON.stringify({
					queueCellGeolocationResolutionJob: {
						cell,
					},
				}),
			)
			const { MessageId, SequenceNumber } = await sqs.send(
				new SendMessageCommand({
					QueueUrl,
					MessageBody: JSON.stringify(cell),
					MessageGroupId: cellId(cell),
					MessageDeduplicationId: cellId(cell),
				}),
			)
			console.debug(
				JSON.stringify({
					queueCellGeolocationResolutionJob: {
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
					queueCellGeolocationResolutionJob: {
						error: (err as Error).message,
						cell,
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
