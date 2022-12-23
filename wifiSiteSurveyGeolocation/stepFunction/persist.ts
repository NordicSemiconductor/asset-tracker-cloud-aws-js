import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'

const { surveysTable } = fromEnv({
	surveysTable: 'SURVEYS_TABLE',
})(process.env)

const dynamodb = new DynamoDBClient({})

export const handler = async (
	maybeLocatedReport: {
		surveyId: string
	} & {
		wifisurveygeo: MaybeLocation
	},
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			wifisurveygeo: maybeLocatedReport,
		}),
	)
	const { located } = maybeLocatedReport.wifisurveygeo
	const Key = {
		surveyId: {
			S: maybeLocatedReport.surveyId,
		},
	}
	if (located) {
		const { lat, lng, accuracy } = maybeLocatedReport.wifisurveygeo
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: surveysTable,
				Key,
				UpdateExpression:
					'SET #unresolved = :unresolved, #lat = :lat, #lng = :lng, #accuracy = :accuracy',
				ExpressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#lat': 'lat',
					'#lng': 'lng',
					'#accuracy': 'accuracy',
				},
				ExpressionAttributeValues: {
					':unresolved': {
						BOOL: false,
					},
					':lat': {
						N: `${lat}`,
					},
					':lng': {
						N: `${lng}`,
					},
					':accuracy': {
						N: `${accuracy}`,
					},
				},
			}),
		)
	} else {
		await dynamodb.send(
			new UpdateItemCommand({
				TableName: surveysTable,
				Key,
				UpdateExpression: 'SET #unresolved = :unresolved',
				ExpressionAttributeNames: {
					'#unresolved': 'unresolved',
				},
				ExpressionAttributeValues: {
					':unresolved': {
						BOOL: true,
					},
				},
			}),
		)
	}

	return true
}
