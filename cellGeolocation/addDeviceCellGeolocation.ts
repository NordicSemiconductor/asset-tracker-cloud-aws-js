import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import { cellId } from '@nordicsemiconductor/cell-geolocation-helpers'
import { randomUUID } from 'node:crypto'
import type { Cell } from '../geolocation/Cell.js'
import type { Location } from '../geolocation/Location.js'

export const addDeviceCellGeolocation =
	({ dynamodb, TableName }: { dynamodb: DynamoDBClient; TableName: string }) =>
	async ({
		cellgeolocation,
		source,
	}: {
		cellgeolocation: Cell & Location
		source: string
	}): Promise<string> => {
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
	}
