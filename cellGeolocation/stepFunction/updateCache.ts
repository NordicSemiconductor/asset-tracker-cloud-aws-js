import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import type { Cell } from '../../geolocation/Cell.js'
import { fromEnv } from '../../util/fromEnv.js'
import type { MaybeCellGeoLocation } from './types.js'
import { cellId } from '../cellId.js'

const { TableName } = fromEnv({
	TableName: 'CACHE_TABLE',
})(process.env)
const dynamodb = new DynamoDBClient({})

export const handler = async (
	maybeLocatedCell: Cell & {
		cellgeo: MaybeCellGeoLocation
	},
): Promise<boolean> => {
	console.log(
		JSON.stringify({
			geolocatedCell: maybeLocatedCell,
		}),
	)
	const { located } = maybeLocatedCell.cellgeo
	let Item = {
		cellId: {
			S: cellId(maybeLocatedCell),
		},
		ttl: {
			N: `${Math.round(Date.now() / 1000) + 24 * 60 * 60}`,
		},
	}
	if (located) {
		const { lat, lng, accuracy, source } = maybeLocatedCell.cellgeo
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
				source: {
					S: `${source}`,
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
