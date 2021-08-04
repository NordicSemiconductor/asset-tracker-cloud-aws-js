import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { fromEnv } from '../../util/fromEnv'
import { getPGPSLocationApiSettings } from './settings'
import { Static, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { pgpsRequestSchema } from '../../pgps/types'
import {
	defaultInterval,
	defaultNumberOfPredictions,
	defaultTimeOfDay,
} from '../../pgps/cacheKey'
import { gpsDay } from '../../pgps/gpsTime'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getPGPSLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

const apiRequestSchema = Type.Object(
	{
		predictionCount: Type.Optional(PositiveInteger),
		predictionIntervalMinutes: Type.Optional(PositiveInteger),
		startGpsDay: Type.Optional(PositiveInteger),
		startGpsTimeOfDaySeconds: Type.Optional(PositiveInteger),
	},
	{ additionalProperties: false },
)

const apiResponseSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		host: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(pgpsRequestSchema)

export const handler = async (
	pgps: Static<typeof pgpsRequestSchema>,
): Promise<{ resolved: boolean; url?: URL }> => {
	console.log(JSON.stringify(pgps))
	const valid = validateInput(pgps)
	if (isLeft(valid)) {
		console.error(JSON.stringify(valid.left))
		return {
			resolved: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const { n, int, day, time } = valid.right

	const result = await c.get({
		resource: 'location/pgps',
		payload: {
			predictionCount: n ?? defaultNumberOfPredictions,
			predictionIntervalMinutes: int ?? defaultInterval,
			startGpsDay: day ?? gpsDay(),
			startGpsTimeOfDaySeconds: time ?? defaultTimeOfDay,
		},
		requestSchema: apiRequestSchema,
		responseSchema: apiResponseSchema,
	})()

	if (isLeft(result)) {
		console.error(JSON.stringify(result.left))
		return { resolved: false }
	}

	return {
		resolved: true,
		url: new URL(`https://${result.right.host}/${result.right.path}`),
	}
}
