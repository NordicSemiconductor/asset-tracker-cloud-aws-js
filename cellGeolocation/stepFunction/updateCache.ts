import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import { StateDocument } from './types'
import { Location } from '../geolocateCell'

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async (
	event: StateDocument & { cellgeo: Location },
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			event,
		}),
	)
	const {
		roaming,
		cellgeo: { lat, lng, accuracy },
	} = event
	await dynamodb.send(
		new PutItemCommand({
			TableName,
			Item: {
				cellId: {
					S: cellId(roaming),
				},
				lat: {
					N: `${lat}`,
				},
				lng: {
					N: `${lng}`,
				},
				accuracy: {
					N: `${accuracy}`,
				},
				ttl: {
					N: `${Math.round(Date.now() / 1000) + 24 * 60 * 60}`,
				},
			},
		}),
	)
	return true
}
