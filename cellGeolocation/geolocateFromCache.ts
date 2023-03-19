import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { none, Option, some } from 'fp-ts/lib/Option'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo.js'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'

export const geolocateFromCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	(
		cell: Cell,
	): TE.TaskEither<
		ErrorInfo,
		Option<{ unresolved: boolean } & Partial<Location>>
	> =>
		TE.tryCatch(
			async () => {
				const { Item } = await dynamodb.send(
					new GetItemCommand({
						TableName,
						Key: {
							cellId: {
								S: cellId(cell),
							},
						},
						ProjectionExpression: 'nw,lat,lng,accuracy,unresolved',
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
							lat: parseFloat(Item?.lat?.N as string),
							lng: parseFloat(Item?.lng?.N as string),
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
				if (
					(err as Error).message === 'NOT_FOUND' ||
					(err as Error).name === 'ResourceNotFoundException'
				)
					return {
						type: ErrorType.EntityNotFound,
						message: `Cell ${cellId(cell)} not found!`,
					}
				console.error(
					JSON.stringify({
						geolocateFromCache: {
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
