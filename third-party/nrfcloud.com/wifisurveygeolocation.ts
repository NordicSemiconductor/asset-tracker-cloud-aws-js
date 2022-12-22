import {
	AttributeValue,
	DynamoDBClient,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { SQSEvent } from 'aws-lambda'
import { URL } from 'url'
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

const { surveysTable, stackName } = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getGroundFixApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const dynamodb = new DynamoDBClient({})

// Lambda function to consume SQS
// We consume input from SQS
type WiFiInput = {
	surveyId: string
	deviceId: string
	timestamp: Date
	unresolved?: boolean
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

		const Key: Record<string, AttributeValue> = {
			surveyId: {
				S: maybeValidInput.surveyId,
			},
		}

		// Request to nRFCloud
		const payload: Static<typeof groundFixRequestSchema> = {
			wifi: {
				accessPoints: maybeValidInput.survey.v.map((item) => {
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

			// Other error, stop progress save the result back into DB and exit
			await dynamodb.send(
				new UpdateItemCommand({
					TableName: surveysTable,
					Key,
					UpdateExpression:
						'SET #unresolved = :unresolved, #inProgress = :notInProgress',
					ExpressionAttributeNames: {
						'#inProgress': 'inProgress',
						'#unresolved': 'unresolved',
					},
					ExpressionAttributeValues: {
						':inProgress': {
							BOOL: true,
						},
						':notInProgress': {
							BOOL: false,
						},
						// FIXME: distinguish between location not found and server error
						':unresolved': {
							BOOL: true,
						},
					},
					ConditionExpression: '#inProgress = :inProgress',
				}),
			)
			return
		}

		const { lat, lon, uncertainty } = maybeWifiGeolocation
		console.debug(JSON.stringify({ lat, lng: lon, accuracy: uncertainty }))
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: surveysTable,
				Key,
				UpdateExpression:
					'SET #unresolved = :notUnresolved, #lat = :lat, #lng = :lng, #accuracy = :accuracy, #inProgress = :notInProgress',
				ExpressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#lat': 'lat',
					'#lng': 'lng',
					'#accuracy': 'accuracy',
					'#inProgress': 'inProgress',
				},
				ExpressionAttributeValues: {
					':notUnresolved': {
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
					':inProgress': {
						BOOL: true,
					},
					':notInProgress': {
						BOOL: false,
					},
				},
				ConditionExpression: '#inProgress = :inProgress',
			}),
		)
		return
	}
}
