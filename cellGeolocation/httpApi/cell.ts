import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import {
	cellId,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { pipe } from 'fp-ts/lib/pipeable'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo.js'
import { resFP } from '../../api/resFP.js'
import { validateWithJSONSchemaFP } from '../../api/validateWithJSONSchemaFP.js'
import { queueJobFP } from '../../geolocation/queueJobFP.js'
import { getOrElse } from '../../util/fp-ts.js'
import { fromEnv } from '../../util/fromEnv.js'
import { geolocateFromCache } from '../geolocateFromCache.js'

const { cellGeolocationResolutionJobsQueue, cacheTable } = fromEnv({
	cellGeolocationResolutionJobsQueue: 'CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
	cacheTable: 'CACHE_TABLE',
})(process.env)

const locator = geolocateFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: cacheTable,
})

const q = queueJobFP({
	QueueUrl: cellGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

const cellInputSchema = Type.Object(
	{
		nw: Type.Enum(NetworkMode),
		cell: Type.Number({
			minimum: 1,
		}),
		area: Type.Number({
			minimum: 1,
		}),
		mccmnc: Type.Number({
			minimum: 10000,
		}),
		// Allow cache busting
		ts: Type.Optional(
			Type.Number({
				minimum: 1,
			}),
		),
	},
	{ additionalProperties: false },
)

console.log(JSON.stringify(cellInputSchema, null, 2))

const validateInput = validateWithJSONSchemaFP(cellInputSchema)

const allMembersToInt = (o: Record<string, any>): Record<string, number> =>
	Object.entries(o).reduce(
		(o, [k, v]) => ({ ...o, [k]: v !== undefined ? parseInt(v, 10) : 0 }),
		{},
	)

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	return pipe(
		validateInput({
			...allMembersToInt(event.queryStringParameters ?? {}),
			nw: event?.queryStringParameters?.nw ?? '',
		}),
		TE.fromEither,
		TE.chain((cell) =>
			pipe(
				locator(cell),
				getOrElse.TE(() =>
					pipe(
						q({ payload: cell, deduplicationId: cellId(cell) }),
						TE.fold(
							(err) => TE.left(err),
							() =>
								TE.left({
									type: ErrorType.Conflict,
									message: 'Calculation for cell geolocation in process',
								}),
						),
					),
				),
			),
		),
		TE.fold(
			(error) =>
				resFP(toStatusCode[error.type], {
					expires: 60,
				})(error),
			(cell) => {
				if (cell.unresolved) {
					return resFP(toStatusCode[ErrorType.EntityNotFound], {
						expires: 86400,
					})({
						type: ErrorType.EntityNotFound,
						message: `cell geolocation not found!`,
					})
				}
				return resFP(200, {
					expires: 86400,
				})({
					lat: cell.lat,
					lng: cell.lng,
					accuracy: cell.accuracy,
				})
			},
		),
	)()
}
