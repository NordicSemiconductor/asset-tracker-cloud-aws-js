import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import Ajv from 'ajv'
import { pipe } from 'fp-ts/lib/pipeable'
import { validate } from './validate'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { Cell, Location } from '../geolocateCell'
import { toStatusCode, ErrorInfo, ErrorType } from '../ErrorInfo'
import { res } from './res'
import { addDeviceCellGeolocation } from '../addDeviceCellGeolocation'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'
import { sequenceT } from 'fp-ts/lib/Apply'
import { fromEnv } from '../../util/fromEnv'

const { deviceCellGeolocationTable, cacheTable } = fromEnv({
	deviceCellGeolocationTable: 'DEVICE_CELL_GEOLOCATION_TABLE',
	cacheTable: 'CACHE_TABLE',
})(process.env)

const dynamodb = new DynamoDBClient({})

const persistDeviceCellGeolocation = addDeviceCellGeolocation({
	dynamodb,
	TableName: deviceCellGeolocationTable,
})

const addToCellGeolocation = addCellToCacheIfNotExists({
	dynamodb,
	TableName: cacheTable,
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
		lat: {
			type: 'number',
			minimum: -90,
			maximum: 90,
		},
		lng: {
			type: 'number',
			minimum: -180,
			maximum: 180,
		},
		accuracy: {
			type: 'number',
			minimum: 0,
			maximum: 50000,
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
