import { TimestreamWrite } from 'aws-sdk'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'
import { toRecord } from './toRecord'

export const batchToTimestreamRecords = (
	event: BatchMessage,
): TimestreamWrite.Records => {
	const r = toRecord([
		{
			Name: 'deviceId',
			Value: event.deviceId,
		},
		{
			Name: 'source',
			Value: 'batch',
		},
	])

	const Records: (TimestreamWrite.Record | undefined)[] = Object.entries(
		event.batch,
	)
		.map(([name, messages]) =>
			(messages as (NumbersValueSensor | NumbersAndStringsValueSensor)[])
				?.map((m) => {
					const ts = m.ts
					return Object.entries(m.v)
						.map(([k, v]) =>
							r({
								name: `${name}.${k}`,
								v,
								ts,
							}),
						)
						.filter(isNotNullOrUndefined)
						.flat()
				})
				.flat(),
		)
		.flat()

	return Records.filter(isNotNullOrUndefined) as TimestreamWrite.Records
}
