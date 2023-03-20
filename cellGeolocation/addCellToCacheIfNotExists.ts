import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { ErrorType, type ErrorInfo } from '../api/ErrorInfo.js'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'
import { fromDeviceLocations } from './cellGeolocationFromDeviceLocations.js'

export const addCellToCacheIfNotExists =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async ({
		nw,
		area,
		mccmnc,
		cell,
		lat,
		lng,
	}: Cell & Location): Promise<{ error: ErrorInfo } | null> => {
		try {
			const cellGeolocation = fromDeviceLocations([
				{
					lat,
					lng,
				},
			])
			if (cellGeolocation === undefined) {
				throw new Error(
					`Failed to determine cell location from ${JSON.stringify({
						lat,
						lng,
					})}`,
				)
			}
			const query = {
				TableName,
				Item: {
					cellId: {
						S: cellId({ nw, area, mccmnc, cell }),
					},
					lat: {
						N: `${cellGeolocation.lat}`,
					},
					lng: {
						N: `${cellGeolocation.lng}`,
					},
					accuracy: {
						N: `${cellGeolocation.accuracy}`,
					},
					ttl: {
						N: `${Math.round(Date.now() / 1000) + 24 * 60 * 60}`,
					},
				},
				ConditionExpression: 'attribute_not_exists(cellId)',
			}
			const res = await dynamodb.send(new PutItemCommand(query))
			console.log(JSON.stringify({ query, res }))
			return null
		} catch (err) {
			if ((err as Error).name === 'ConditionalCheckFailedException') {
				return null
			}
			console.error(
				JSON.stringify({
					addCellToCacheIfNotExists: { error: err, TableName },
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
