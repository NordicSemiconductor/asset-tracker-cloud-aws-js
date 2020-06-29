import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { pipe } from 'fp-ts/lib/pipeable'
import { geolocateCellFromCache, Cell } from '../geolocateCell'
import { isSome } from 'fp-ts/lib/Option'
import { MaybeCellGeoLocation } from './types'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE ?? '',
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
