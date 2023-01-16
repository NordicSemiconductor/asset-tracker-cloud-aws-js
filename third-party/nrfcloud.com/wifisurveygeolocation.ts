import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import { groundFixRequestSchema } from './groundFixRequestSchema'
import { locateResultSchema } from './locate'
import { getGroundFixApiSettings } from './settings'

function removeUndefinedProperties<T extends object>(obj: T): T {
	const result: Partial<T> = {}
	for (const key in obj) {
		// eslint-disable-next-line no-prototype-builtins
		if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
			result[key] = obj[key]
		}
	}
	return result as T
}

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getGroundFixApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

type WiFiInput = {
	surveyId: string
	deviceId: string
	timestamp: Date
	survey: {
		v: {
			chan?: number
			mac: string
			rssi?: number
			ssid?: string
		}[]
	}
}

export const handler = async (event: WiFiInput): Promise<MaybeLocation> => {
	console.log(JSON.stringify(event))

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const maybeValidInput = event

	// Request to nRFCloud
	const payload: Static<typeof groundFixRequestSchema> = {
		wifi: {
			accessPoints: maybeValidInput.survey.v.map((item) => {
				const accessPoint = {
					macAddress: item.mac,
					channel: item.chan,
					signalStrength: item.rssi,
					ssid: item.ssid,
				}
				return removeUndefinedProperties(accessPoint)
			}),
		},
	}
	const maybeWifiGeolocation = await c.post({
		resource: 'location/ground-fix',
		payload,
		requestSchema: groundFixRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})

	if ('error' in maybeWifiGeolocation) {
		console.error(JSON.stringify(maybeWifiGeolocation))
		return {
			located: false,
		}
	}

	const { lat, lon, uncertainty } = maybeWifiGeolocation
	console.debug(JSON.stringify({ lat, lng: lon, accuracy: uncertainty }))
	return {
		lat,
		lng: lon,
		accuracy: uncertainty,
		located: true,
	}
}
