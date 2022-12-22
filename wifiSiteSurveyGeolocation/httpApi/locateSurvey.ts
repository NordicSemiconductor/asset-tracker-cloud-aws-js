import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorInfo, ErrorType, toStatusCode } from '../../api/ErrorInfo'
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

const dynamodb = new DynamoDBClient({})
const locator = geolocateSurvey({
	dynamodb,
	TableName: surveysTable,
})

const q = queueJob({
	QueueUrl: wifiSiteSurveyGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

type QFunction = ({
	payload,
	deduplicationId,
	delay,
}: {
	payload: unknown
	deduplicationId?: string
	delay?: number
}) => Promise<void | { error: ErrorInfo }>

const wifiSurveyResolver =
	({
		dynamodb,
		tableName,
		q,
	}: {
		dynamodb: DynamoDBClient
		tableName: string
		q: QFunction
	}) =>
	async ({
		surveyId,
		payload,
	}: {
		surveyId: string
		payload: unknown
	}): Promise<void> => {
		// Update status in DB
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: tableName,
				Key: {
					surveyId: {
						S: surveyId,
					},
				},
				UpdateExpression:
					'SET #inProgress = :inProgress, #attemptTimestamp = :attemptTimestamp',
				ExpressionAttributeNames: {
					'#inProgress': 'inProgress',
					'#attemptTimestamp': 'attemptTimestamp',
				},
				ExpressionAttributeValues: {
					':inProgress': {
						BOOL: true,
					},
					':notInProgress': {
						BOOL: false,
					},
					':attemptTimestamp': {
						S: `${new Date().toISOString()}`,
					},
				},
				ConditionExpression:
					'attribute_not_exists(#inProgress) or #inProgress = :notInProgress',
			}),
		)

		// Send to queue
		await q({
			payload: payload,
		})
	}

const resolveWifiSurvey = wifiSurveyResolver({
	dynamodb,
	tableName: surveysTable,
	q,
})

// We will retry to resolve the location again if attempt timestamp is older than 24hr
const attemptOlderThan24Hours = (attemptTimestamp: Date): boolean => {
	const over24hrFromLastRetry =
		Date.now() - new Date(attemptTimestamp).getTime() > 24 * 60 * 60 * 1000
	if (over24hrFromLastRetry) return true
	return false
}

const inProgressResponse = res(toStatusCode[ErrorType.Conflict], {
	expires: 60,
})({
	type: ErrorType.Conflict,
	message: 'Calculation for WiFi site survey geolocation in process',
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

	console.log(JSON.stringify(maybeSurvey))

	const {
		survey: { surveyId, location, unresolved, inProgress, attemptTimestamp },
	} = maybeSurvey

	// survey was located
	if (location !== undefined) {
		return res(200, {
			expires: 86400,
		})(location)
	}

	// survey was not resolved
	if (unresolved === true) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: 'WiFi site survey geolocation could not be resolved',
		})
	}

	// Resolution is in progress
	if (inProgress === true) {
		console.log(`Resolution of ${surveyId} already in progress.`)
		return inProgressResponse
	}

	// It was previously attempted to resolve the survey, which failed.
	// Try again after 24 hours
	if (
		attemptTimestamp !== undefined &&
		attemptOlderThan24Hours(attemptTimestamp)
	) {
		await resolveWifiSurvey({
			surveyId: surveyId,
			payload: maybeSurvey.survey,
		})
		return inProgressResponse
	}

	// Survey was never attempted to be resolved
	await resolveWifiSurvey({
		surveyId: surveyId,
		payload: maybeSurvey.survey,
	})
	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for WiFi site survey geolocation in process',
	})
}
