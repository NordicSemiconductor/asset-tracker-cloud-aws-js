import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { ErrorType, type ErrorInfo } from '../api/ErrorInfo.js'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'

export const geolocateFromCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (
		cell: Cell,
	): Promise<
		{ error: ErrorInfo } | ({ unresolved: boolean } & Partial<Location>)
	> => {
		try {
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
					return {
						unresolved,
					}
				} else {
					return {
						unresolved,
						lat: parseFloat(Item?.lat?.N as string),
						lng: parseFloat(Item?.lng?.N as string),
						accuracy:
							Item?.accuracy?.N !== undefined
								? parseFloat(Item.accuracy.N)
								: 5000,
					}
				}
			}
			throw new Error('NOT_FOUND')
		} catch (err) {
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return {
					error: {
						type: ErrorType.EntityNotFound,
						message: `Cell ${cellId(cell)} not found!`,
					},
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
				error: {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				},
			}
		}
	}
