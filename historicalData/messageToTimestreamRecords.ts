import { TimestreamWrite } from 'aws-sdk'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'
import { toRecord } from './toRecord'

export const messageToTimestreamRecords = (
	event: DeviceMessage,
): TimestreamWrite.Records => {
	const r = toRecord([
		{
			Name: 'deviceId',
			Value: event.deviceId,
		},
	])

	const Records: (TimestreamWrite.Record | undefined)[] = []
	if (event.message.btn !== undefined) {
		Records.push(
			r({
				name: 'btn',
				ts: event.message.btn.ts,
				v: event.message.btn.v,
			}),
		)
	}

	return Records.filter(isNotNullOrUndefined) as TimestreamWrite.Records
}
