import { SSMClient } from '@aws-sdk/client-ssm'
import type { TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import type { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types.js'
import type { Cell } from '../../geolocation/Cell.js'
import { parseMCCMNC } from '../../geolocation/parseMCCMNC.js'
import { fromEnv } from '../../util/fromEnv.js'
import { apiClient } from './apiclient.js'
import { groundFixRequestSchema } from './groundFixRequestSchema.js'
import { locateResultSchema } from './locate.js'
import { getGroundFixApiSettings } from './settings.js'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getGroundFixApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(cell))

	const { serviceKey, teamId, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const [mcc, mnc] = parseMCCMNC(cell.mccmnc)
	const maybeCellGeolocation = await c.post({
		resource: 'location/ground-fix',
		payload: {
			lte: [
				{
					eci: cell.cell,
					mcc,
					mnc,
					tac: cell.area,
				},
			],
		},
		requestSchema: groundFixRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})
	if ('error' in maybeCellGeolocation) {
		console.error(JSON.stringify(maybeCellGeolocation))
		return {
			located: false,
		}
	}
	const { lat, lon, uncertainty } = maybeCellGeolocation
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
