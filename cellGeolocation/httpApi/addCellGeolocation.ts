import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { Cell, Location } from '../geolocateCell'
import { toStatusCode, ErrorInfo, ErrorType } from '../ErrorInfo'
import { res } from './res'
import { addDeviceCellGeolocation } from '../addDeviceCellGeolocation'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'
import { sequenceT } from 'fp-ts/lib/Apply'

const dynamodb = new DynamoDBClient({})

const persistDeviceCellGeolocation = addDeviceCellGeolocation({
	dynamodb,
	TableName: process.env.DEVICE_CELL_GEOLOCATION_TABLE ?? '',
})

const addToCellGeolocation = addCellToCacheIfNotExists({
	dynamodb,
	TableName: process.env.CACHE_TABLE ?? '',
})

const inputSchema = new Ajv().compile({
	type: 'object',
	properties: {
		cell: {
			type: 'number',
			min: 1,
		},
		area: {
			type: 'number',
			min: 1,
		},
		mccmnc: {
			type: 'number',
			min: 10000,
		},
		lat: {
			type: 'number',
			min: -90,
			max: 90,
		},
		lng: {
			type: 'number',
			min: -180,
			max: 180,
		},
		accuracy: {
			type: 'number',
			min: 0,
			max: 50000,
		},
	},
	required: ['cell', 'area', 'mccmnc', 'lat', 'lng', 'accuracy'],
	additionalProperties: false,
})

const toIntOr0 = (v?: any) => parseInt(v ?? '0', 10)
const toFloatOr0 = (v?: any) => parseFloat(v ?? '0')

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))
	return pipe(
		E.parseJSON<ErrorInfo>(event?.body ?? '', () => ({
			message: `Failed to parse body "${event.body}"!`,
			type: ErrorType.BadRequest,
		})),
		E.map((body) => {
			const b = body as any
			return validate<Cell & Location>(inputSchema)({
				cell: toIntOr0(b.cell),
				area: toIntOr0(b.area),
				mccmnc: toIntOr0(b.mccmnc),
				lat: toFloatOr0(b.lat),
				lng: toFloatOr0(b.lng),
				accuracy: toFloatOr0(b.accuracy),
			})()
		}),
		E.flatten,
		TE.fromEither,
		TE.map((cellgeolocation) =>
			sequenceT(TE.taskEither)(
				// Persist cell geo locations
				persistDeviceCellGeolocation({
					cellgeolocation,
					source: `api:${event.requestContext.identity.sourceIp}:${event.requestContext.identity.userAgent}`,
				}),
				// If this is the first time we see this cell, make it available in the cache
				addToCellGeolocation(cellgeolocation),
			),
		),
		TE.flatten,
		TE.map(([id]) => id),
		TE.fold((error) => res(toStatusCode[error.type])(error), res(202)),
	)()
}
