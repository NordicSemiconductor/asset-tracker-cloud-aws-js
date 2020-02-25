import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'
import { Location, Cell } from './geolocateCell'
import { pipe } from 'fp-ts/lib/pipeable'

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
	accuracy,
}: Cell & Location): TE.TaskEither<ErrorInfo, void> =>
	pipe(
		TE.tryCatch<ErrorInfo, void>(
			async () => {
				const query = {
					TableName,
					Item: {
						cellId: {
							S: cellId({ area, mccmnc, cell }),
						},
						lat: {
							N: `${lat}`,
						},
						lng: {
							N: `${lng}`,
						},
						accuracy: {
							N: `${Math.round(accuracy)}`,
						},
					},
					ConditionExpression: 'attribute_not_exists(cellId)',
				}
				const res = await dynamodb.send(new PutItemCommand(query))
				console.log(JSON.stringify({ query, res }))
			},
			err => {
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
			e => (e.type === ErrorType.Conflict ? TE.right(undefined) : TE.left(e)),
			() => TE.right(undefined),
		),
	)
