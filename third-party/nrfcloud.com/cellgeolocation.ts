import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { Cell } from '../../cellGeolocation/geolocateCell'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from './settings'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfConnectForCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const locateResultSchema = Type.Object({
	location: Type.Object({
		lat: Type.Number({ minimum: -90, maximum: 90 }),
		lng: Type.Number({ minimum: -180, maximum: 180 }),
	}),
	accuracy: Type.Number({ minimum: 0 }),
})

const locateRequestSchema = Type.Dict(
	Type.Object(
		{
			cid: Type.Number({ minimum: 1 }),
			mcc: Type.Number({ minimum: 100, maximum: 999 }),
			mnc: Type.Number({ minimum: 1, maximum: 99 }),
			tac: Type.Number({ minimum: 1 }),
		},
		{ additionalProperties: false },
	),
)

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(cell))

	const { apiKey, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), apiKey })

	const mccmnc = cell.mccmnc.toFixed(0)
	const maybeCeollGeolocation = await c.post({
		resource: 'location/locate/nRFAssetTrackerForAWS',
		payload: {
			[cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [
				{
					cid: cell.cell,
					mcc: parseInt(mccmnc.substr(0, mccmnc.length - 2), 10),
					mnc: parseInt(mccmnc.substr(-2), 10),
					tac: cell.area,
				},
			],
		},
		requestSchema: locateRequestSchema,
		responseSchema: locateResultSchema,
	})()
	if (isLeft(maybeCeollGeolocation)) {
		console.error(JSON.stringify(maybeCeollGeolocation.left))
		return {
			located: false,
		}
	}
	const {
		location: { lat, lng },
		accuracy,
	} = maybeCeollGeolocation.right
	console.debug(JSON.stringify({ lat, lng, accuracy }))
	return {
		lat,
		lng,
		accuracy,
		located: true,
	}
}
