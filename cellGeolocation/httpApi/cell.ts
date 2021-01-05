import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
	geolocateCellFromCache,
	Cell,
	queueCellGeolocationResolutionJob,
} from '../geolocateCell'
import { toStatusCode, ErrorType } from '../ErrorInfo'
import { res } from './res'
import { SQSClient } from '@aws-sdk/client-sqs'
import { getOrElse } from '../../util/fp-ts'
import { fromEnv } from '../../util/fromEnv'

const { cellGeolocationResolutionJobsQueue, cacheTable } = fromEnv({
	cellGeolocationResolutionJobsQueue: 'CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
	cacheTable: 'CACHE_TABLE',
})(process.env)

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: cacheTable,
})

const q = queueCellGeolocationResolutionJob({
	QueueUrl: cellGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

const inputSchema = new Ajv().compile({
	type: 'object',
	properties: {
		cell: {
			type: 'number',
			minimum: 1,
		},
		area: {
			type: 'number',
			minimum: 1,
		},
		mccmnc: {
			type: 'number',
			minimum: 10000,
		},
		// Allow cache busting
		ts: {
			type: 'number',
			minimum: 1,
		},
	},
	required: ['cell', 'area', 'mccmnc'],
	additionalProperties: false,
})

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
		validate<Cell>(inputSchema)(
			allMembersToInt(event.queryStringParameters ?? {}),
		)(),
		TE.fromEither,
		TE.chain((cell) =>
			pipe(
				locator(cell),
				getOrElse.TE(() =>
					pipe(
						q(cell),
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
				res(toStatusCode[error.type], {
					expires: 60,
				})(error),
			(cell) => {
				if (cell.unresolved) {
					return res(toStatusCode[ErrorType.EntityNotFound], {
						expires: 86400,
					})({
						type: ErrorType.EntityNotFound,
						message: `cell geolocation for ${cell} not found!`,
					})
				}
				return res(200, {
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
