import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import * as TE from 'fp-ts/lib/TaskEither'
import { randomUUID } from 'node:crypto'
import { ErrorInfo, ErrorType } from '../api/ErrorInfo'
import { Cell } from '../geolocation/Cell'
import { Location } from '../geolocation/Location'

export const addDeviceCellGeolocation =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	({
		cellgeolocation,
		source,
	}: {
		cellgeolocation: Cell & Location
		source: string
	}): TE.TaskEither<ErrorInfo, string> =>
		TE.tryCatch<ErrorInfo, string>(
			async () => {
				const id = randomUUID()
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
							nw: {
								S: `${cellgeolocation.nw}`,
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
					JSON.stringify({
						addDeviceCellGeolocation: { error: err, TableName },
					}),
				)
				return {
					type: ErrorType.InternalError,
					message: (err as Error).message,
				}
			},
		)
