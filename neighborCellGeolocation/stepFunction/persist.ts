import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'

const { TableName } = fromEnv({
	TableName: 'REPORTS_TABLE',
})(process.env)
const dynamodb = new DynamoDBClient({})

export const handler = async (
	maybeLocatedReport: {
		reportId: string
	} & {
		ncellmeasgeo: MaybeLocation
	},
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			ncellmeasgeo: maybeLocatedReport,
		}),
	)
	const { located } = maybeLocatedReport.ncellmeasgeo
	const Key = {
		reportId: {
			S: maybeLocatedReport.reportId,
		},
	}
	if (located) {
		const { lat, lng, accuracy } = maybeLocatedReport.ncellmeasgeo
		await dynamodb.send(
			new UpdateItemCommand({
				TableName,
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
				TableName,
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
