import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb-v2-node'
import {
	cellId,
	cellFromGeolocations,
} from '@bifravst/cell-geolocation-helpers'
import { StateDocument, CellGeo } from './types'
import { isSome } from 'fp-ts/lib/Option'

const TableName = process.env.LOCATIONS_TABLE || ''
const IndexName = process.env.LOCATIONS_TABLE_CELLID_INDEX || ''
const dynamodb = new DynamoDBClient({})
const c = cellFromGeolocations({
	minCellDiameterInMeters: 5000,
	percentile: 0.9,
})

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
		const location = c(
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
