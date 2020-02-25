import {
	DynamoDBClient,
	GetItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'

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
}) => (cell: Cell) =>
	TE.tryCatch<ErrorInfo, { lat: number; lng: number }>(
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
					ProjectionExpression: 'lat,lng,accuracy',
				}),
			)
			if (Item)
				return {
					lat: parseFloat(Item.lat.N as string),
					lng: parseFloat(Item.lng.N as string),
					accuracy: Item.accuracy.N ? parseInt(Item.accuracy.N) : 5000,
				}
			throw new Error('NOT_FOUND')
		},
		err => {
			const id = cellId(cell)
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return {
					type: ErrorType.EntityNotFound,
					message: `Cell ${id} not found!`,
				}
			console.error(JSON.stringify({ error: err }))
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)
