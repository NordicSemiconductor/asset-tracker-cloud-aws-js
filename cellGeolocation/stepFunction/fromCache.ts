import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { pipe } from 'fp-ts/lib/pipeable'
import { geolocateCellFromCache, Cell } from '../geolocateCell'
import { isSome } from 'fp-ts/lib/Option'
import { MaybeCellGeoLocation } from './types'
import { fromEnv } from '../../util/fromEnv'

const { cacheTable } = fromEnv({
	cacheTable: 'CACHE_TABLE',
})(process.env)

const locator = geolocateCellFromCache({
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
