import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'
import { Location, Cell } from './geolocateCell'
import { pipe } from 'fp-ts/lib/pipeable'
import { fromDeviceLocations } from './cellGeolocationFromDeviceLocations'
import { isSome } from 'fp-ts/lib/Option'

export const addCellToCacheIfNotExists = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({
	area,
	mccmnc,
	cell,
	lat,
	lng,
}: Cell & Location): TE.TaskEither<ErrorInfo, void> =>
	pipe(
		TE.tryCatch<ErrorInfo, void>(
			async () => {
				const location = fromDeviceLocations([
					{
						lat,
						lng,
					},
				])
				if (!isSome(location)) {
					throw new Error(
						`Failed to determine cell location from ${JSON.stringify({
							lat,
							lng,
						})}`,
					)
				}
				const cellGeoLocation = location.value
				const query = {
					TableName,
					Item: {
						cellId: {
							S: cellId({ area, mccmnc, cell }),
						},
						lat: {
							N: `${cellGeoLocation.lat}`,
						},
						lng: {
							N: `${cellGeoLocation.lng}`,
						},
						accuracy: {
							N: `${cellGeoLocation.accuracy}`,
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
			(e) => (e.type === ErrorType.Conflict ? TE.right(undefined) : TE.left(e)),
			() => TE.right(undefined),
		),
	)
