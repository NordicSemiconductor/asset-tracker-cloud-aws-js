import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { sequenceT } from 'fp-ts/lib/Apply'
import * as E from 'fp-ts/lib/Either'
import { pipe } from 'fp-ts/lib/function'
import * as JSON from 'fp-ts/lib/Json'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType, toStatusCode } from '../../api/ErrorInfo'
import { res } from '../../api/res'
import { validateWithJSONSchemaFP } from '../../api/validateWithJSONSchemaFP'
import { Cell } from '../../geolocation/Cell'
import { Location } from '../../geolocation/Location'
import { fromEnv } from '../../util/fromEnv'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'
import { addDeviceCellGeolocation } from '../addDeviceCellGeolocation'

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

const cellGeolocationInputSchema = Type.Object(
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
		lat: Type.Number({
			minimum: -90,
			maximum: 90,
		}),
		lng: Type.Number({
			minimum: -180,
			maximum: 180,
		}),
		accuracy: Type.Number({
			minimum: 1,
			maximum: 50000,
		}),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchemaFP(cellGeolocationInputSchema)

const toIntOr0 = (v?: any) => parseInt(v ?? '0', 10)
const toFloatOr0 = (v?: any) => parseFloat(v ?? '0')

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))
	return pipe(
		JSON.parse(event?.body ?? ''),
		E.mapLeft(() => ({
			message: `Failed to parse body "${event.body}"!`,
			type: ErrorType.BadRequest,
		})),
		E.map((body) => {
			const b = body as any
			return validateInput({
				cell: toIntOr0(b.cell),
				area: toIntOr0(b.area),
				mccmnc: toIntOr0(b.mccmnc),
				lat: toFloatOr0(b.lat),
				lng: toFloatOr0(b.lng),
				accuracy: toFloatOr0(b.accuracy),
				nw: b.nw,
			})
		}),
		E.flatten,
		E.map((cellgeolocation) => {
			if (cellgeolocation.lat === 0 && cellgeolocation.lng === 0)
				return E.left<ErrorInfo, Cell & Location>({
					message: `Both lat and lng are 0, ignoring. This is probably bogus test data.`,
					type: ErrorType.BadRequest,
				})
			return E.right<ErrorInfo, Cell & Location>(cellgeolocation)
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
		TE.fold(
			(error) => res(toStatusCode[(error as ErrorInfo).type])(error),
			res(202),
		),
	)()
}
