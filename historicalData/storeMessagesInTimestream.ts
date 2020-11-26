import { TimestreamWrite } from 'aws-sdk'
import { fromEnv } from '../util/fromEnv'
import { toTimestreamRecords } from './toTimestreamRecords'

const { messagesTableInfo, updatesTableInfo } = fromEnv({
	messagesTableInfo: 'MESSAGES_TABLE_NAME',
	updatesTableInfo: 'UPDATES_TABLE_NAME',
})(process.env)

const [messagesDb, messagesTable] = messagesTableInfo.split('|')
const [updatesDb, updatesTable] = updatesTableInfo.split('|')

console.log(
	JSON.stringify({
		messagesTable,
		messagesDb,
		updatesTable,
		updatesDb,
	}),
)

const storeUpdateInTimeseries = (timeseries: TimestreamWrite) => async (
	event: UpdatedDeviceState,
): Promise<void> => {
	const args = {
		DatabaseName: updatesDb,
		TableName: updatesTable,
		Records: toTimestreamRecords(event),
	}
	console.log(JSON.stringify(args))
	await timeseries.writeRecords(args).promise()
}

const storeUpdate = storeUpdateInTimeseries(new TimestreamWrite())

/**
 * Processes device messages and updates and stores the in Timestream
 */
export const handler = async (event: UpdatedDeviceState): Promise<void> => {
	console.log(JSON.stringify(event))
	if ('reported' in event) {
		await storeUpdate(event)
		return
	}
	console.error(
		JSON.stringify({
			error: 'Unknown event',
			event,
		}),
	)
}
