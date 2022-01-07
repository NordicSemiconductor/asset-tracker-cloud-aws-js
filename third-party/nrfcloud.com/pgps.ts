import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, Type } from '@sinclair/typebox'
import { isLeft } from 'fp-ts/lib/Either'
import { URL } from 'url'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema.js'
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

const settings = await getPGPSLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

enum Interval {
	twoHours = 120,
	fourHours = 240,
	sixHours = 360,
	eightHours = 480,
}
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

	const { serviceKey, teamId, endpoint } = settings
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
