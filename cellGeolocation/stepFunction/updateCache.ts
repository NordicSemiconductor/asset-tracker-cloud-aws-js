import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import { Location, Cell } from '../geolocateCell'

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async (
	geolocatedCell: Cell & { cellgeo: Location },
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			geolocatedCell,
		}),
	)
	const { lat, lng, accuracy } = geolocatedCell.cellgeo
	await dynamodb.send(
		new PutItemCommand({
			TableName,
			Item: {
				cellId: {
					S: cellId(geolocatedCell),
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
