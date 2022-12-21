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

const getWifiSurveyResolver =
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
		const Key = {
			surveyId: {
				S: surveyId,
			},
		}
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: tableName,
				Key,
				UpdateExpression:
					'SET #inProgress = :inProgress, #attempt = :attempt, #attemptTimestamp = :attemptTimestamp',
				ExpressionAttributeNames: {
					'#inProgress': 'inProgress',
					'#attempt': 'attempt',
					'#attemptTimestamp': 'attemptTimestamp',
				},
				ExpressionAttributeValues: {
					':inProgress': {
						BOOL: true,
					},
					':attempt': {
						NULL: true,
					},
					':attemptTimestamp': {
						NULL: true,
					},
				},
			}),
		)

		// Send to queue
		await q({
			payload: payload,
		})
	}

const resolveWifiSurvey = getWifiSurveyResolver({
	dynamodb,
	tableName: surveysTable,
	q,
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

	if ('location' in maybeSurvey.survey) {
		return res(200, {
			expires: 86400,
		})(maybeSurvey.survey.location)
	}

	if (maybeSurvey.survey.unresolved === true) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: 'WiFi site survey geolocation could not be resolved',
		})
	}

	// We will retry to resolve the location again if
	// 1. unresolved = undefined
	// 2. attempt timestamp is older than 24hr
	const attemptTimestamp = maybeSurvey.survey.attemptTimestamp ?? Date.now()
	const over24hrFromLastRetry = Date.now() - attemptTimestamp > 86400000
	const shouldResolveWifiSurvey =
		maybeSurvey.survey.inProgress === undefined ||
		(maybeSurvey.survey.unresolved === undefined && over24hrFromLastRetry)

	// We flag status into DB. Then we can have only one job per survey id to get resolved
	if (shouldResolveWifiSurvey) {
		await resolveWifiSurvey({
			surveyId: maybeSurvey.survey.surveyId,
			payload: maybeSurvey.survey,
		})
	}

	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for WiFi site survey geolocation in process',
	})
}
