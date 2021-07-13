import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import * as TE from 'fp-ts/lib/TaskEither'
import * as T from 'fp-ts/lib/Task'
import { geolocateReport } from '../geolocateReport'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'
import { pipe } from 'fp-ts/lib/function'

const { reportsTable } = fromEnv({
	reportsTable: 'REPORTS_TABLE',
})(process.env)

const locator = geolocateReport({
	dynamodb: new DynamoDBClient({}),
	TableName: reportsTable,
})

export const handler = async (input: {
	reportId: string
}): Promise<MaybeLocation> =>
	pipe(
		locator(input.reportId),
		TE.map((report) => {
			if ('location' in report) {
				return {
					located: true,
					...report.location,
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
