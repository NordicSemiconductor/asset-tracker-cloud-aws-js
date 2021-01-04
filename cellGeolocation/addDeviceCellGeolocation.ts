import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@bifravst/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { ErrorInfo, ErrorType } from './ErrorInfo'
import { Location, Cell } from './geolocateCell'
import { v4 } from 'uuid'

export const addDeviceCellGeolocation = ({
	dynamodb,
	TableName,
}: {
	dynamodb: DynamoDBClient
	TableName: string
}) => ({
	cellgeolocation,
	source,
}: {
	cellgeolocation: Cell & Location
	source: string
}): TE.TaskEither<ErrorInfo, string> =>
	TE.tryCatch<ErrorInfo, string>(
		async () => {
			const id = v4()
			await dynamodb.send(
				new PutItemCommand({
					TableName,
					Item: {
						uuid: {
							S: id,
						},
						cellId: {
							S: cellId(cellgeolocation),
						},
						cell: {
							N: `${cellgeolocation.cell}`,
						},
						mccmnc: {
							N: `${cellgeolocation.mccmnc}`,
						},
						area: {
							N: `${cellgeolocation.area}`,
						},
						lat: {
							N: `${cellgeolocation.lat}`,
						},
						lng: {
							N: `${cellgeolocation.lng}`,
						},
						source: {
							S: source,
						},
						timestamp: {
							S: new Date().toISOString(),
						},
					},
				}),
			)
			return id
		},
		(err) => {
			console.error(
				JSON.stringify({ addDeviceCellGeolocation: { error: err, TableName } }),
			)
			return {
				type: ErrorType.InternalError,
				message: (err as Error).message,
			}
		},
	)
