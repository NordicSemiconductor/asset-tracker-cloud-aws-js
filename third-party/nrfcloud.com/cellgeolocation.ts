import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { getNrfCloudApiSettings } from './settings'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { locateResultSchema } from './locate'
import { Cell } from '../../geolocation/Cell'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const locateRequestSchema = Type.Record(
	Type.Union([Type.Literal('nbiot'), Type.Literal('lte')]),
	Type.Array(
		Type.Object(
			{
				cid: Type.Integer({ minimum: 1 }),
				mcc: Type.Integer({ minimum: 100, maximum: 999 }),
				mnc: Type.Integer({ minimum: 1, maximum: 99 }),
				tac: Type.Integer({ minimum: 1 }),
			},
			{ additionalProperties: false },
		),
		{ minItems: 1 },
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
