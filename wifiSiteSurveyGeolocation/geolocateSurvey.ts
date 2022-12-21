import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { Location } from '../geolocation/Location'

type Survey = {
	deviceId: string
	timestamp: Date
	surveyId: string
	survey: Record<string, any>
	unresolved: boolean
	attempt?: number
	attemptTimestamp?: number
	inProgress?: boolean
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
				attempt: entry.attempt,
				attemptTimestamp: entry.attemptTimestamp,
				inProgress: entry.inProgress,
				survey: entry.survey as Record<string, any>,
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
