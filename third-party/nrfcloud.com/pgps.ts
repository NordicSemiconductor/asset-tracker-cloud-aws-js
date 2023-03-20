import { SSMClient } from '@aws-sdk/client-ssm'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs/protocol'
import { Type, type Static } from '@sinclair/typebox'
import { URL } from 'url'
import {
	defaultInterval,
	defaultNumberOfPredictions,
	defaultTimeOfDay,
} from '../../pgps/cacheKey.js'
import { gpsDay, minimumGpsDay } from '../../pgps/gpsTime.js'
import { pgpsRequestSchema } from '../../pgps/types.js'
import { fromEnv } from '../../util/fromEnv.js'
import { apiClient } from './apiclient.js'
import { getPGPSLocationApiSettings } from './settings.js'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const settingsPromise = getPGPSLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

enum Interval {
	twoHours = 120,
	fourHours = 240,
	sixHours = 360,
	eightHours = 480,
}

/**
 * @see https://api.nrfcloud.com/v1#tag/Predicted-GPS/operation/GetPredictedAssistanceData
 */
const apiRequestSchema = Type.Object(
	{
		predictionCount: Type.Optional(
			Type.Integer({
				minimum: 1,
				maximum: 168,
				title: 'number of predictions',
			}),
		),
		predictionIntervalMinutes: Type.Optional(
			Type.Enum(Interval, { title: 'prediction interval in minutes' }),
		),
		startGpsDay: Type.Optional(
			Type.Integer({
				minimum: minimumGpsDay(),
				maximum: gpsDay() + 14, // Current GPS day + 2 weeks is the upper bound for nRF Cloud
				title: 'start day of the prediction set as GPS Day',
			}),
		),
		startGpsTimeOfDaySeconds: Type.Optional(
			Type.Integer({
				minimum: 0,
				maximum: 86399,
				title: 'start time of the prediction set as seconds in day',
			}),
		),
	},
	{ additionalProperties: false },
)

/**
 * @see https://api.nrfcloud.com/v1#tag/Predicted-GPS/operation/GetPredictedAssistanceData
 */
const apiResponseSchema = Type.Object(
	{
		path: Type.String({ minLength: 1 }),
		host: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithType(pgpsRequestSchema)

export const handler = async (
	pgps: Static<typeof pgpsRequestSchema>,
): Promise<{ resolved: boolean; url?: URL }> => {
	console.log(JSON.stringify(pgps))
	const maybeValidInput = validateInput(pgps)
	if ('errors' in maybeValidInput) {
		console.error(JSON.stringify(maybeValidInput))
		return {
			resolved: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const { n, int, day, time } = maybeValidInput

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
	})

	if ('error' in result) {
		console.error(JSON.stringify(result))
		return { resolved: false }
	}

	return {
		resolved: true,
		url: new URL(`https://${result.host}/${result.path}`),
	}
}
