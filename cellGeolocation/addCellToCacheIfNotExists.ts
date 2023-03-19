import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { pipe } from 'fp-ts/lib/function'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo.js'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'
import { fromDeviceLocations } from './cellGeolocationFromDeviceLocations.js'

export const addCellToCacheIfNotExists =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	({
		nw,
		area,
		mccmnc,
		cell,
		lat,
		lng,
	}: Cell & Location): TE.TaskEither<ErrorInfo, void> =>
		pipe(
			TE.tryCatch<ErrorInfo, void>(
				async () => {
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
				},
				(err) => {
					if ((err as Error).name === 'ConditionalCheckFailedException') {
						return {
							type: ErrorType.Conflict,
							message: (err as Error).message,
						}
					}
					console.error(
						JSON.stringify({
							addCellToCacheIfNotExists: { error: err, TableName },
						}),
					)
					return {
						type: ErrorType.InternalError,
						message: (err as Error).message,
					}
				},
			),
			TE.fold(
				(e) =>
					e.type === ErrorType.Conflict ? TE.right(undefined) : TE.left(e),
				() => TE.right(undefined),
			),
		)
