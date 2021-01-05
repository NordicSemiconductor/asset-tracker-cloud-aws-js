import { _Record, Dimension } from '@aws-sdk/client-timestream-write'
import { fromEnv } from '../util/fromEnv'
import { batchToTimestreamRecords } from './batchToTimestreamRecords'
import { getTimestreamWriteClient } from './timestreamClient'
import { messageToTimestreamRecords } from './messageToTimestreamRecords'
import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords'
import { storeRecordsInTimeseries } from './storeRecordsInTimeseries'

const { tableInfo } = fromEnv({
	tableInfo: 'TABLE_INFO',
})(process.env)

const [DatabaseName, TableName] = tableInfo.split('|')
const store = (async () =>
	storeRecordsInTimeseries({
		timestream: await getTimestreamWriteClient(),
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
			await storeUpdate(shadowUpdateToTimestreamRecords(event), Dimensions)
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
				error: err.message,
			}),
		)
		return
	}
}
