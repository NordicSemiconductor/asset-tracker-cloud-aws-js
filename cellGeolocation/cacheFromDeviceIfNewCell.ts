import {
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb-v2-node'

const TableName = process.env.CACHE_TABLE || ''
const dynamodb = new DynamoDBClient({})

export const handler = async ({
	cellId,
	lat,
	lng,
}: {
	uuid: string
	cell: number
	mccmnc: number
	area: number
	cellId: string
	lat: number
	lng: number
	source: string
	timestamp: string
}) => {
	await dynamodb.send(
		new PutItemCommand({
			TableName,
			Item: {
				cellId: {
					S: cellId,
				},
				lat: {
					N: `${lat}`,
				},
				lng: {
					N: `${lng}`,
				},
			},
			ConditionExpression: 'attribute_not_exists(cellId)',
		}),
	)
}
