import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { Cell } from '../../geolocation/Cell'
import { fromEnv } from '../../util/fromEnv'
import { fromDeviceLocations } from '../cellGeolocationFromDeviceLocations'
import { MaybeCellGeoLocation } from './types'

const { TableName, IndexName } = fromEnv({
	TableName: 'LOCATIONS_TABLE',
	IndexName: 'LOCATIONS_TABLE_CELLID_INDEX',
})(process.env)
const dynamodb = new DynamoDBClient({})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	const { Items } = await dynamodb.send(
		new QueryCommand({
			TableName,
			IndexName,
			KeyConditionExpression: 'cellId = :cellId',
			ExpressionAttributeValues: {
				[':cellId']: {
					S: cellId(cell),
				},
			},
			ProjectionExpression: 'lat,lng,accuracy',
		}),
	)

	if (Items !== undefined && (Items?.length ?? 0) > 0) {
		const location = fromDeviceLocations(
			Items.map(({ lat, lng }) => ({
				lat: parseFloat(lat.N as string),
				lng: parseFloat(lng.N as string),
			})),
		)

		if (location !== undefined) {
			console.log(
				JSON.stringify({
					cell,
					location,
				}),
			)

			return {
				located: true,
				...location,
			}
		}
	}
	return {
		located: false,
	}
}