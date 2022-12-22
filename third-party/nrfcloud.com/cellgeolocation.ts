import { SSMClient } from '@aws-sdk/client-ssm'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { Cell } from '../../geolocation/Cell'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import { locateResultSchema } from './locate'
import { locateRequestSchema } from './locateRequestSchema'
import { getCellLocationApiSettings } from './settings'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getCellLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

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
					mcc: parseInt(mccmnc.slice(0, mccmnc.length - 2), 10),
					mnc: parseInt(mccmnc.slice(-2), 10),
					tac: cell.area,
				},
			],
		},
		requestSchema: locateRequestSchema as unknown as TObject<TProperties>,
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
