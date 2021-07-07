import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'

const { TableName } = fromEnv({
	TableName: 'REPORTS_TABLE',
})(process.env)
const dynamodb = new DynamoDBClient({})

export const handler = async (
	maybeLocatedReport: { reportId: string } & {
		ncellmeasgeo: MaybeLocation
	},
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			ncellmeasgeo: maybeLocatedReport,
		}),
	)
	const { located } = maybeLocatedReport.ncellmeasgeo
	let Item = {
		reportId: {
			S: maybeLocatedReport.reportId,
		},
	}
	if (located) {
		const { lat, lng, accuracy } = maybeLocatedReport.ncellmeasgeo
		Item = {
			...Item,
			...{
				lat: {
					N: `${lat}`,
				},
				lng: {
					N: `${lng}`,
				},
				accuracy: {
					N: `${accuracy}`,
				},
			},
		}
	} else {
		Item = {
			...Item,
			...{
				unresolved: {
					BOOL: true,
				},
			},
		}
	}

	await dynamodb.send(
		new PutItemCommand({
			TableName,
			Item,
		}),
	)

	return true
}
