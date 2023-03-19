import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs/protocol'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo.js'
import { res } from '../../api/res.js'
import { fromEnv } from '../../util/fromEnv.js'
import { parseJSON } from '../../util/parseJSON.js'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists.js'
import { addDeviceCellGeolocation } from '../addDeviceCellGeolocation.js'

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

const validateInput = validateWithType(cellGeolocationInputSchema)

const toIntOr0 = (v?: any) => parseInt(v ?? '0', 10)
const toFloatOr0 = (v?: any) => parseFloat(v ?? '0')

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const maybeJSON = parseJSON(event?.body ?? '')
	if ('error' in maybeJSON)
		return res(toStatusCode[ErrorType.BadRequest])(maybeJSON.error)

	const b = maybeJSON.json

	const maybeCellGeolocation = validateInput({
		cell: toIntOr0(b.cell),
		area: toIntOr0(b.area),
		mccmnc: toIntOr0(b.mccmnc),
		lat: toFloatOr0(b.lat),
		lng: toFloatOr0(b.lng),
		accuracy: toFloatOr0(b.accuracy),
		nw: b.nw,
	})
	if ('errors' in maybeCellGeolocation) {
		return res(toStatusCode[ErrorType.BadRequest])(maybeCellGeolocation.errors)
	}
	const cellgeolocation = maybeCellGeolocation

	if (cellgeolocation.lat === 0 && cellgeolocation.lng === 0)
		return res(toStatusCode[ErrorType.BadRequest])({
			message: `Both lat and lng are 0, ignoring. This is probably bogus test data.`,
			type: ErrorType.BadRequest,
		})

	// Persist cell geo locations
	const id = await persistDeviceCellGeolocation({
		cellgeolocation,
		source: `api:${event.requestContext.http.sourceIp}:${event.requestContext.http.userAgent}`,
	})
	// If this is the first time we see this cell, make it available in the cache
	const maybeAdded = await addToCellGeolocation(cellgeolocation)
	if (maybeAdded !== null && 'error' in maybeAdded) {
		return res(toStatusCode[maybeAdded.error.type])(maybeAdded.error)
	}

	return res(202)(id)
}
