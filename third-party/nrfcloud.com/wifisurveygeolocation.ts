import {
	AttributeValue,
	DynamoDBClient,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { SQSEvent } from 'aws-lambda'
import { URL } from 'url'
import { ErrorType } from '../../api/ErrorInfo'
import { queueJob } from '../../geolocation/queueJob'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import { groundFixRequestSchema } from './groundFixRequestSchema'
import { locateResultSchema } from './locate'
import { getGroundFixApiSettings } from './settings'

function removeUndefinedProperties<T extends object>(obj: T): T {
	const result: Partial<T> = {}
	for (const key in obj) {
		// eslint-disable-next-line no-prototype-builtins
		if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
			result[key] = obj[key]
		}
	}
	return result as T
}

const {
	surveysTable,
	wifiSiteSurveyGeolocationResolutionJobsQueue,
	stackName,
} = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
	wifiSiteSurveyGeolocationResolutionJobsQueue:
		'WIFI_SITESURVEY_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getGroundFixApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const q = queueJob({
	QueueUrl: wifiSiteSurveyGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

const dynamodb = new DynamoDBClient({})

// Lambda function to consume SQS
// We consume input from SQS
type WiFiInput = {
	surveyId: string
	deviceId: string
	timestamp: Date
	unresolved?: boolean
	attempt?: number
	attemptTimestamp?: Date
	inProgress?: boolean
	survey: {
		wmr: {
			chan?: number
			mac: string
			rssi?: number
			ssid?: string
		}[]
	}
}

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify(event))

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	for (const ev of event.Records) {
		const maybeValidInput = JSON.parse(ev.body) as WiFiInput
		const attempt = maybeValidInput.attempt ?? 1

		const Key: Record<string, AttributeValue> = {
			surveyId: {
				S: maybeValidInput.surveyId,
			},
		}
		// Updated attempt and attempt timestamp into DB
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: surveysTable,
				Key,
				UpdateExpression:
					'SET #attempt = :attempt, #attemptTimestamp = :attemptTimestamp',
				ExpressionAttributeNames: {
					'#attempt': 'attempt',
					'#attemptTimestamp': 'attemptTimestamp',
				},
				ExpressionAttributeValues: {
					':attempt': {
						N: `${attempt}`,
					},
					':attemptTimestamp': {
						S: `${new Date().toISOString()}`,
					},
				},
			}),
		)

		// Request to nRFCloud
		const payload: Static<typeof groundFixRequestSchema> = {
			wifi: {
				accessPoints: maybeValidInput.survey.wmr.map((item) => {
					const accessPoint = {
						macAddress: item.mac,
						channel: item.chan,
						signalStrength: item.rssi,
						ssid: item.ssid,
					}
					return removeUndefinedProperties(accessPoint)
				}),
			},
		}
		const maybeWifiGeolocation = await c.post({
			resource: 'location/ground-fix',
			payload,
			requestSchema: groundFixRequestSchema as unknown as TObject<TProperties>,
			responseSchema: locateResultSchema,
		})

		if ('error' in maybeWifiGeolocation) {
			console.error(JSON.stringify(maybeWifiGeolocation))

			if (
				attempt <= 3 &&
				maybeWifiGeolocation.error.type === ErrorType.BadGateway
			) {
				const delay = 2 ** (attempt - 1)
				console.log(`Attempt for ${maybeValidInput.surveyId} on ${attempt}`)
				await q({
					payload: Object.assign(maybeValidInput, { attempt: attempt + 1 }),
					delay,
				})
				return
			}

			// Other error, we can assume it is unresolved. Then, save the result back into DB and exit
			await dynamodb.send(
				new UpdateItemCommand({
					TableName: surveysTable,
					Key,
					UpdateExpression:
						'SET #unresolved = :unresolved, #inProgress = :inProgress',
					ExpressionAttributeNames: {
						'#unresolved': 'unresolved',
						'#inProgress': 'inProgress',
					},
					ExpressionAttributeValues: {
						':unresolved': {
							BOOL: true,
						},
						':inProgress': {
							BOOL: false,
						},
					},
				}),
			)
			return
		}

		const { lat, lon, uncertainty } = maybeWifiGeolocation
		console.debug(
			JSON.stringify({ lat, lng: lon, accuracy: uncertainty, located: true }),
		)
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: surveysTable,
				Key,
				UpdateExpression:
					'SET #unresolved = :unresolved, #lat = :lat, #lng = :lng, #accuracy = :accuracy, #located = :located, #inProgress = :inProgress',
				ExpressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#lat': 'lat',
					'#lng': 'lng',
					'#accuracy': 'accuracy',
					'#located': 'located',
					'#inProgress': 'inProgress',
				},
				ExpressionAttributeValues: {
					':unresolved': {
						BOOL: false,
					},
					':lat': {
						N: `${lat}`,
					},
					':lng': {
						N: `${lon}`,
					},
					':accuracy': {
						N: `${uncertainty}`,
					},
					':located': {
						BOOL: true,
					},
					':inProgress': {
						BOOL: false,
					},
				},
			}),
		)
		return
	}
}
