import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import { addCellToCacheIfNotExists } from '../addCellToCacheIfNotExists'
import { Location, Cell } from '../geolocateCell'

const addToCellGeolocation = addCellToCacheIfNotExists({
	TableName: process.env.CACHE_TABLE || '',
	dynamodb: new DynamoDBClient({}),
})

export const handler = async (event: Cell & Location) => {
	console.log(JSON.stringify({ event }))
	return addToCellGeolocation(event)()
}
