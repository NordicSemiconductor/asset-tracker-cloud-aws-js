import { SSMClient } from '@aws-sdk/client-ssm'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { TObject, TProperties, Type } from '@sinclair/typebox'
import { isLeft } from 'fp-ts/lib/Either'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types.js'
import { Cell } from '../../geolocation/Cell.js'
import { fromEnv } from '../../util/fromEnv.js'
import { apiClient } from './apiclient.js'
import { locateResultSchema } from './locate.js'
import { getCellLocationApiSettings } from './settings.js'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getCellLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const locateRequestSchema = Type.Record(
	Type.Union([Type.Literal('nbiot'), Type.Literal('lte')]),
	Type.Array(
		Type.Object(
			{
				eci: Type.Integer({ minimum: 1 }),
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

	if (cell.nw === NetworkMode.NBIoT) {
		console.error(`Resolution of NB-IoT cells not yet supported.`)
		return {
			located: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const mccmnc = cell.mccmnc.toFixed(0)
	const maybeCellGeolocation = await c.post({
		resource: 'location/cell',
		payload: {
			// FIXME: enable check once NB-IoT is supported: [cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [
			lte: [
				{
					eci: cell.cell,
					mcc: parseInt(mccmnc.substr(0, mccmnc.length - 2), 10),
					mnc: parseInt(mccmnc.substr(-2), 10),
					tac: cell.area,
				},
			],
		},
		requestSchema: locateRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})()
	if (isLeft(maybeCellGeolocation)) {
		console.error(JSON.stringify(maybeCellGeolocation.left))
		return {
			located: false,
		}
	}
	const { lat, lon, uncertainty } = maybeCellGeolocation.right
	console.debug(
		JSON.stringify({ lat, lng: lon, accuracy: uncertainty, located: true }),
	)
	return {
		lat,
		lng: lon,
		accuracy: uncertainty,
		located: true,
	}
}
