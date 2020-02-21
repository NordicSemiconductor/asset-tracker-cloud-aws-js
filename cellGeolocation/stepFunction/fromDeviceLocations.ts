import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb-v2-node'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import { StateDocument, CellGeo } from './types'

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
			ProjectionExpression: 'lat,lng',
		}),
	)

	if (Items?.length) {
		// Calculate the center of the cell as the median of all lat and lng measurements on record
		const asc = (a: number, b: number) => a - b
		const lats = Items.map(({ lat }) => parseFloat(lat.N as string)).sort(asc)
		const lngs = Items.map(({ lng }) => parseFloat(lng.N as string)).sort(asc)

		console.log(
			JSON.stringify({
				cell: input.roaming,
				lats,
				lngs,
			}),
		)

		return {
			located: true,
			lat: lats[Math.floor(lats.length / 2)],
			lng: lngs[Math.floor(lngs.length / 2)],
		}
	}
	return {
		located: false,
	}
}
