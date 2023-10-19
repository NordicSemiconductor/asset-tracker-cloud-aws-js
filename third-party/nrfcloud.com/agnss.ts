import { SSMClient } from '@aws-sdk/client-ssm'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs/protocol'
import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { Type, type Static } from '@sinclair/typebox'
import { URL } from 'url'
import { AGNSSType, agnssRequestSchema } from '../../agnss/types.js'
import type { ErrorInfo } from '../../api/ErrorInfo.js'
import { fromEnv } from '../../util/fromEnv.js'
import { apiClient } from './apiclient.js'
import { getLocationServicesApiSettings } from './settings.js'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getLocationServicesApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

/**
 * @see https://api.nrfcloud.com/v1#tag/Assisted-GPS/operation/GetAssistanceData
 */
const apiRequestSchema = Type.Object(
	{
		eci: PositiveInteger,
		tac: PositiveInteger,
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 999 }),
		types: Type.Array(Type.Enum(AGNSSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithType(agnssRequestSchema)

export const handler = async (
	agnss: Static<typeof agnssRequestSchema>,
): Promise<{ resolved: boolean; dataHex?: readonly string[] }> => {
	console.log(JSON.stringify({ event: agnss }))
	const maybeValidInput = validateInput(agnss)
	if ('errors' in maybeValidInput) {
		console.error(JSON.stringify(maybeValidInput))
		return {
			resolved: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const { mcc, mnc, cell, area, types } = maybeValidInput.value

	// Split requests, so that request for Ephemerides is a separate one
	const otherTypesInRequest = types.filter(
		(t) => t !== AGNSSType['GPS Ephemerides'],
	)
	const requestTypes = []
	if (types.includes(AGNSSType['GPS Ephemerides']))
		requestTypes.push([AGNSSType['GPS Ephemerides']])
	if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

	try {
		const res = await Promise.all(
			requestTypes.map(async (types) => {
				const request = {
					resource: 'location/agnss',
					payload: {
						eci: cell,
						tac: area,
						mcc,
						mnc,
						types,
					},
					headers: {
						'Content-Type': 'application/octet-stream',
					},
				}

				const headers = await c.head({
					...request,
					method: 'GET',
					requestSchema: apiRequestSchema,
				})

				if ('error' in headers) {
					throw new Error(
						`Failed the request A-GNSS data info: ${
							(headers.error as ErrorInfo).message
						}`,
					)
				}

				const agnssData = await c.getBinary({
					...request,
					headers: {
						...request.headers,
						Range: `bytes=0-${headers['content-length']}`,
					},
					requestSchema: apiRequestSchema,
				})

				if ('error' in agnssData) {
					throw new Error(
						`Failed the request A-GNSS data: ${agnssData.error.message}`,
					)
				}

				const agnssDataInfo = verify(agnssData)

				if ('error' in agnssDataInfo) {
					throw new Error(
						`Failed the request A-GNSS data: ${agnssDataInfo.error.message}`,
					)
				}
				console.log(JSON.stringify({ agnssData: agnssDataInfo }))
				return agnssData.toString('hex')
			}),
		)
		// If any request fails, mark operation as failed
		if (res.length !== requestTypes.length) {
			console.error(`Resolved ${res.length}, expected ${requestTypes.length}!`)
			return {
				resolved: false,
			}
		}
		return {
			resolved: true,
			dataHex: res,
		}
	} catch (err) {
		console.error(err)
		return {
			resolved: false,
		}
	}
}
