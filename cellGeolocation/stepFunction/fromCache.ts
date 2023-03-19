import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { isSome } from 'fp-ts/lib/Option'
import { pipe } from 'fp-ts/lib/pipeable'
import * as T from 'fp-ts/lib/Task'
import * as TE from 'fp-ts/lib/TaskEither'
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

export const handler = async (input: Cell): Promise<MaybeCellGeoLocation> =>
	pipe(
		locator(input),
		TE.map((optionalLocation) => {
			if (isSome(optionalLocation)) {
				return {
					located: true,
					...optionalLocation.value,
				}
			}
			return { located: false }
		}),
		TE.getOrElse(() =>
			T.of({
				located: false,
			}),
		),
	)()
