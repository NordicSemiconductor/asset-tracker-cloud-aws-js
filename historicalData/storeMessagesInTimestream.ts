import type { Dimension, _Record } from '@aws-sdk/client-timestream-write'
import { toRecord, writeClient } from '@nordicsemiconductor/timestream-helpers'
import { fromEnv } from '../util/fromEnv.js'
import { batchToTimestreamRecords } from './batchToTimestreamRecords.js'
import { messageToTimestreamRecords } from './messageToTimestreamRecords.js'
import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords.js'
import { storeRecordsInTimeseries } from './storeRecordsInTimeseries.js'
import { randomUUID } from 'node:crypto'

const { tableInfo } = fromEnv({
	tableInfo: 'TABLE_INFO',
})(process.env)

const [DatabaseName, TableName] = tableInfo.split('|') as [string, string]
const store = (async () =>
	storeRecordsInTimeseries({
		timestream: await writeClient(),
		DatabaseName,
		TableName,
	}))()

const storeUpdate = async (Records: _Record[], Dimensions: Dimension[]) => {
	console.debug(
		JSON.stringify({ DatabaseName, TableName, Records, Dimensions }),
	)
	return (await store)(Records, { Dimensions })
}

/**
 * Processes device messages and updates and stores the in Timestream
 */
export const handler = async (
	event: UpdatedDeviceState | DeviceMessage | BatchMessage,
): Promise<void> => {
	console.debug(JSON.stringify(event))

	const Dimensions = [
		{
			Name: 'deviceId',
			Value: event.deviceId,
		},
	]

	try {
		if ('reported' in event) {
			const { cfg, bat, ...reported } = event.reported
			void cfg // remove from reported
			const records = shadowUpdateToTimestreamRecords({
				reported,
			})
			if (bat !== undefined) {
				const batRecord = toRecord({
					name: 'bat',
					ts: bat.ts,
					v: bat.v,
					dimensions: {
						measureGroup: records[0]?.Dimensions?.[0]?.Value ?? randomUUID(),
					},
				})
				if (batRecord !== undefined) {
					records.push(batRecord)
				}
			}
			await storeUpdate(records, Dimensions)
			return
		}
		if ('message' in event) {
			await storeUpdate(messageToTimestreamRecords(event), Dimensions)
			return
		}
		if ('batch' in event) {
			await storeUpdate(batchToTimestreamRecords(event), [
				...Dimensions,
				{
					Name: 'source',
					Value: 'batch',
				},
			])
			return
		}
		console.error(
			JSON.stringify({
				error: 'Unknown event',
				event,
			}),
		)
	} catch (err) {
		console.error(err)
		console.error(
			JSON.stringify({
				error: (err as Error).message,
			}),
		)
		return
	}
}
