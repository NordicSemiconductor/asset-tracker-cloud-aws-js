import { SSMClient } from '@aws-sdk/client-ssm'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
import { TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { Cell } from '../../geolocation/Cell'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import { locateResultSchema } from './locate'
import { groundfixRequestSchema } from './groundfixRequestSchema'
import { getWifiLocationApiSettings } from './settings'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getWifiLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (accessPoints: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(accessPoints))

	// if (cell.nw === NetworkMode.NBIoT) {
	// 	console.error(`Resolution of NB-IoT cells not yet supported.`)
	// 	return {
	// 		located: false,
	// 	}
	// }

	const { serviceKey, teamId, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	// const mccmnc = cell.mccmnc.toFixed(0)
	const maybeWifiGeolocation = await c.post({
		resource: 'location/ground-fix',
		payload: {
			wifi: accessPoints,
		},
		requestSchema: groundfixRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})
	if ('error' in maybeWifiGeolocation) {
		console.error(JSON.stringify(maybeWifiGeolocation))
		return {
			located: false,
		}
	}
	const { lat, lon, uncertainty } = maybeWifiGeolocation
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
