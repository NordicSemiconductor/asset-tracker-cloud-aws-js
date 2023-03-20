import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { Cell } from '../../geolocation/Cell.js'
import { fromEnv } from '../../util/fromEnv.js'
import { geolocateFromCache } from '../geolocateFromCache.js'
import type { MaybeCellGeoLocation } from './types.js'

const { cacheTable } = fromEnv({
	cacheTable: 'CACHE_TABLE',
})(process.env)

const locator = geolocateFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: cacheTable,
})

export const handler = async (input: Cell): Promise<MaybeCellGeoLocation> => {
	const optionalLocation = await locator(input)
	if ('error' in optionalLocation) return { located: false }
	return {
		located: true,
		...optionalLocation,
	}
}
