import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import { StateDocument, CellGeo } from './types'
import { isSome } from 'fp-ts/lib/Option'
import { fromDeviceLocations } from '../cellGeolocationFromDeviceLocations'

const TableName = process.env.LOCATIONS_TABLE || ''
const IndexName = process.env.LOCATIONS_TABLE_CELLID_INDEX || ''
const dynamodb = new DynamoDBClient({})

export const handler = async (input: StateDocument): Promise<CellGeo> => {
	const { Items } = await dynamodb.send(
		new QueryCommand({
			TableName,
			IndexName,
			KeyConditionExpression: 'cellId = :cellId',
			ExpressionAttributeValues: {
				[':cellId']: {
					S: cellId(input.roaming),
				},
			},
			ProjectionExpression: 'lat,lng,accuracy',
		}),
	)

	if (Items?.length) {
		const location = fromDeviceLocations(
			Items.map(({ lat, lng }) => ({
				lat: parseFloat(lat.N as string),
				lng: parseFloat(lng.N as string),
			})),
		)

		if (isSome(location)) {
			console.log(
				JSON.stringify({
					cell: input.roaming,
					location,
				}),
			)

			return {
				located: true,
				...location.value,
			}
		}
	}
	return {
		located: false,
	}
}
