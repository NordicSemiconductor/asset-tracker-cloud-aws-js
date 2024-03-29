import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { ErrorType, type ErrorInfo } from '../api/ErrorInfo.js'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'
import { cellId } from './cellId.js'
import type { LocationSource } from './stepFunction/types.js'

export const geolocateFromCache =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (
		cell: Cell,
	): Promise<
		| { error: ErrorInfo }
		| (({ unresolved: true } | { unresolved: false; source: LocationSource }) &
				Partial<Location>)
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
					ExpressionAttributeNames: {
						'#nw': 'nw',
						'#lat': 'lat',
						'#lng': 'lng',
						'#accuracy': 'accuracy',
						'#unresolved': 'unresolved',
						'#source': 'source',
					},
					ProjectionExpression: '#nw,#lat,#lng,#accuracy,#unresolved,#source',
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
						source: Item?.source?.S as LocationSource,
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
