import { TimestreamWrite } from 'aws-sdk'
import { fromEnv } from '../util/fromEnv'
import { batchToTimestreamRecords } from './batchToTimestreamRecords'
import { messageToTimestreamRecords } from './messageToTimestreamRecords'
import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords'
import { storeRecordsInTimeseries } from './storeRecordsInTimeseries'

const { tableInfo } = fromEnv({
	tableInfo: 'TABLE_INFO',
})(process.env)

const [DatabaseName, TableName] = tableInfo.split('|')

const store = storeRecordsInTimeseries({
	timestream: new TimestreamWrite(),
	DatabaseName,
	TableName,
})
const storeUpdate = async (Records: TimestreamWrite.Records) => {
	console.log({ DatabaseName, TableName, Records })
	return store(Records)
}

/**
 * Processes device messages and updates and stores the in Timestream
 */
export const handler = async (
	event: UpdatedDeviceState | DeviceMessage | BatchMessage,
): Promise<void> => {
	console.log(JSON.stringify(event))

	try {
		if ('reported' in event) {
			await storeUpdate(shadowUpdateToTimestreamRecords(event))
			return
		}
		if ('message' in event) {
			await storeUpdate(messageToTimestreamRecords(event))
			return
		}
		if ('batch' in event) {
			await storeUpdate(batchToTimestreamRecords(event))
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
