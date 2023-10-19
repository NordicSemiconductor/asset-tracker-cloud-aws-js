import { SSMClient } from '@aws-sdk/client-ssm'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs/protocol'
import { verify } from '@nordicsemiconductor/nrfcloud-location-services-tests'
import { Type, type Static } from '@sinclair/typebox'
import { URL } from 'url'
import { AGPSType, agpsRequestSchema } from '../../agps/types.js'
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
		requestType: Type.RegEx(/^custom$/),
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 999 }),
		customTypes: Type.Array(Type.Enum(AGPSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithType(agpsRequestSchema)

export const handler = async (
	agps: Static<typeof agpsRequestSchema>,
): Promise<{ resolved: boolean; dataHex?: readonly string[] }> => {
	console.log(JSON.stringify({ event: agps }))
	const maybeValidInput = validateInput(agps)
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
	const otherTypesInRequest = types.filter((t) => t !== AGPSType.Ephemerides)
	const requestTypes = []
	if (types.includes(AGPSType.Ephemerides))
		requestTypes.push([AGPSType.Ephemerides])
	if (otherTypesInRequest.length > 0) requestTypes.push(otherTypesInRequest)

	try {
		const res = await Promise.all(
			requestTypes.map(async (types) => {
				const request = {
					resource: 'location/agps',
					payload: {
						eci: cell,
						tac: area,
						requestType: 'custom',
						mcc,
						mnc,
						customTypes: types,
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
						`Failed the request A-GPS data info: ${
							(headers.error as ErrorInfo).message
						}`,
					)
				}

				const agpsData = await c.getBinary({
					...request,
					headers: {
						...request.headers,
						Range: `bytes=0-${headers['content-length']}`,
					},
					requestSchema: apiRequestSchema,
				})

				if ('error' in agpsData) {
					throw new Error(
						`Failed the request A-GPS data: ${agpsData.error.message}`,
					)
				}

				const agpsDataInfo = verify(agpsData)

				if ('error' in agpsDataInfo) {
					throw new Error(
						`Failed the request A-GPS data: ${agpsDataInfo.error.message}`,
					)
				}
				console.log(JSON.stringify({ agpsData: agpsDataInfo }))
				return agpsData.toString('hex')
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
		console.error(JSON.stringify(err))
		return {
			resolved: false,
		}
	}
}
