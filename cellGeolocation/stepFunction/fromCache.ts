import { DynamoDBClient } from '@aws-sdk/client-dynamodb-v2-node'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { pipe } from 'fp-ts/lib/pipeable'
import { geolocateCellFromCache } from '../geolocateCell'
import { StateDocument, CellGeo } from './types'

const locator = geolocateCellFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: process.env.CACHE_TABLE || '',
})

export const handler = async (input: StateDocument): Promise<CellGeo> =>
	pipe(
		locator(input.roaming),
		TE.fold(
			() =>
				T.of({
					located: false,
				}),
			location =>
				T.of({
					located: true,
					...location,
				}),
		),
	)()
