import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { fromEnv } from '../../util/fromEnv'
import { getAGPSLocationApiSettings } from './settings'
import { Static, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft, isRight, Right } from 'fp-ts/lib/Either'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { agpsRequestSchema, AGPSType } from '../../agps/types'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getAGPSLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

const apiRequestSchema = Type.Object(
	{
		deviceIdentifier: Type.String({ minLength: 1 }),
		eci: PositiveInteger,
		tac: PositiveInteger,
		requestType: Type.RegEx(/^custom$/),
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
		customTypes: Type.Array(Type.Enum(AGPSType), { minItems: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(agpsRequestSchema)

export const handler = async (
	agps: Static<typeof agpsRequestSchema>,
): Promise<{ resolved: boolean; data?: string[] }> => {
	console.log(JSON.stringify(agps))
	const valid = validateInput(agps)
	if (isLeft(valid)) {
		console.error(JSON.stringify(valid.left))
		return {
			resolved: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })
	const fetchTypes = async (types: AGPSType[]) =>
		c.get({
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
				// FIXME: use dynamic value from HEAD request. Currently broken on nRF Cloud side
				Range: `bytes=0-2000`,
			},
			requestSchema: apiRequestSchema,
			responseSchema: Type.String({ minLength: 1, maxLength: 2000 }),
		})()

	const { mcc, mnc, cell, area, types } = valid.right

	// Split requests, so that request for Ephemerides is a separate one
	const requests = []

	if (types.includes(AGPSType.Ephemerides))
		requests.push(fetchTypes([AGPSType.Ephemerides]))

	const otherTypesInRequest = types.filter((t) => t !== AGPSType.Ephemerides)
	if (otherTypesInRequest.length > 0)
		requests.push(fetchTypes(otherTypesInRequest))

	const results = await Promise.all(requests)

	// If any request fails, mark operation as failed
	const resolved = results.filter((maybeAGPS) => {
		if (isLeft(maybeAGPS)) {
			console.error(JSON.stringify(maybeAGPS.left))
		}
		return isRight(maybeAGPS)
	})
	if (resolved.length !== requests.length)
		return {
			resolved: false,
		}

	return {
		resolved: true,
		data: resolved.map((r) => (r as Right<string>).right),
	}
}
