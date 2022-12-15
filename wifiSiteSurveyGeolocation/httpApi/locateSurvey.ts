import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo'
import { res } from '../../api/res'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { queueJob } from '../../geolocation/queueJob'
import { fromEnv } from '../../util/fromEnv'
import { geolocateSurvey } from '../geolocateSurvey'

const inputSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

const validateInput = validateWithJSONSchema(inputSchema)

const { surveysTable, wifiSiteSurveyGeolocationResolutionJobsQueue } = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
	wifiSiteSurveyGeolocationResolutionJobsQueue:
		'WIFI_SITESURVEY_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
})(process.env)

const locator = geolocateSurvey({
	dynamodb: new DynamoDBClient({}),
	TableName: surveysTable,
})

const q = queueJob({
	QueueUrl: wifiSiteSurveyGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const id = event.requestContext.http.path.slice(1) // path: /3bf67b25-acd9-474c-b97a-3cb6083b7c44
	const maybeValidRequest = validateInput({ id })
	if ('error' in maybeValidRequest) {
		return res(toStatusCode[ErrorType.BadRequest])(maybeValidRequest.error)
	}

	const maybeSurvey = await locator(maybeValidRequest.id)
	if ('error' in maybeSurvey) {
		if (maybeSurvey.error.type === ErrorType.EntityNotFound) {
			return res(toStatusCode[maybeSurvey.error.type], {
				expires: 86400,
			})({
				type: ErrorType.EntityNotFound,
				message: `WiFi site survey not found!`,
			})
		}
		return res(toStatusCode[maybeSurvey.error.type], {
			expires: 60,
		})(maybeSurvey.error)
	}

	console.log(JSON.stringify({ survey: maybeSurvey }))

	if ('location' in maybeSurvey) {
		return res(200, {
			expires: 86400,
		})(maybeSurvey.location)
	}

	if (maybeSurvey.survey.unresolved) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: 'WiFi site survey geolocation could not be resolved',
		})
	}

	await q({
		deduplicationId: maybeValidRequest.id,
		payload: maybeSurvey.survey,
	})

	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for WiFi site survey geolocation in process',
	})
}
