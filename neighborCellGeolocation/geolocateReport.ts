import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { Location } from '../geolocation/Location'
import { unmarshall } from '@aws-sdk/util-dynamodb'

type Report = {
	deviceId: string
	timestamp: Date
	reportId: string
	nw: string
	report: Record<string, any>
	unresolved: boolean
}

export const geolocateReport =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	(id: string): TE.TaskEither<ErrorInfo, Report & { location?: Location }> =>
		TE.tryCatch(
			async () => {
				const { Item } = await dynamodb.send(
					new GetItemCommand({
						TableName,
						Key: {
							reportId: {
								S: id,
							},
						},
					}),
				)

				console.debug(
					JSON.stringify({
						geolocateReport: Item,
					}),
				)

				if (Item !== undefined) {
					const entry = unmarshall(Item)
					const report: Report & { location?: Location } = {
						reportId: entry.reportId,
						deviceId: entry.deviceId,
						timestamp: new Date(entry.timestamp),
						unresolved: entry.unresolved,
						report: entry.report as Record<string, any>,
						nw: entry.nw,
					}
					if ('lat' in entry) {
						report.location = {
							lat: entry.lat,
							lng: entry.lng,
							accuracy: entry.accuracy ?? 5000,
						}
					}
					return report
				}

				throw new Error('NOT_FOUND')
			},
			(err) => {
				if (
					(err as Error).message === 'NOT_FOUND' ||
					(err as Error).name === 'ResourceNotFoundException'
				)
					return {
						type: ErrorType.EntityNotFound,
						message: `Report ${id} not found!`,
					}
				console.error(
					JSON.stringify({
						geolocateReport: {
							err,
							errorMessage: (err as Error).message,
							id,
							TableName,
						},
					}),
				)
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		)
