import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from './settings'
import { Static, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { agpsRequestSchema, AGPSType } from '../../agps/types'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfConnectForCloudApiSettings({
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

	const { apiKey, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), apiKey })

	const { mcc, mnc, cell, area, types } = valid.right
	// FIXME: if type 2 is requested, resolve it seperately to keep chunk size < 2000 byte
	const maybeAGPS = await c.get({
		resource: 'location/agps',
		payload: {
			deviceIdentifier: 'nRFAssetTrackerForAWS',
			eci: cell,
			tac: area,
			requestType: 'custom',
			mcc,
			mnc,
			customTypes: types,
		},
		headers: {
			'Content-Type': 'application/octet-stream',
			// FIXME: use dynamic value from HEAD request. Currently broken on nRF Connect for Cloud side
			Range: `bytes=0-2000`,
		},
		requestSchema: apiRequestSchema,
		responseSchema: Type.String({ minLength: 1, maxLength: 2000 }),
	})()
	if (isLeft(maybeAGPS)) {
		console.error(JSON.stringify(maybeAGPS.left))
		return {
			resolved: false,
		}
	}
	console.debug(
		`Received ${
			maybeAGPS.right.length
		} bytes for requested types ${JSON.stringify(types)}`,
	)
	return {
		resolved: true,
		data: [maybeAGPS.right],
	}
}
