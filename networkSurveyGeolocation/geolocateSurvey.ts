import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { Location } from '../geolocation/Location'

export type Survey = {
	deviceId: string
	timestamp: Date
	surveyId: string
	unresolved: boolean
	lte?: Record<string, any>
	nw?: string
	wifi?: Record<string, any>
}

export const geolocateSurvey =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async (
		id: string,
	): Promise<
		{ error: ErrorInfo } | { survey: Survey & { location?: Location } }
	> => {
		try {
			const { Item } = await dynamodb.send(
				new GetItemCommand({
					TableName,
					Key: {
						surveyId: {
							S: id,
						},
					},
				}),
			)

			console.debug(
				JSON.stringify({
					geolocateSurvey: Item,
				}),
			)

			if (Item === undefined) throw new Error('NOT_FOUND')

			const entry = unmarshall(Item)
			const survey: Survey & { location?: Location } = {
				surveyId: entry.surveyId,
				deviceId: entry.deviceId,
				timestamp: new Date(entry.timestamp),
				unresolved: entry.unresolved,
				lte: entry.lte as Record<string, any> | undefined,
				nw: entry.nw as string | undefined,
				wifi: entry.wifi as Record<string, any> | undefined,
			}
			if ('lat' in entry) {
				survey.location = {
					lat: entry.lat,
					lng: entry.lng,
					accuracy: entry.accuracy ?? 5000,
				}
			}
			return { survey }
		} catch (err) {
			if (
				(err as Error).message === 'NOT_FOUND' ||
				(err as Error).name === 'ResourceNotFoundException'
			)
				return {
					error: {
						type: ErrorType.EntityNotFound,
						message: `Survey ${id} not found!`,
					},
				}
			console.error(
				JSON.stringify({
					geolocateSurvey: {
						err,
						errorMessage: (err as Error).message,
						id,
						TableName,
					},
				}),
			)
			return {
				error: {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				},
			}
		}
	}
