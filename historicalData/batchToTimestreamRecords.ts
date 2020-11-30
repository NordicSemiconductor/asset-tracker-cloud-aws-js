import { TimestreamWrite } from 'aws-sdk'
import { v4 } from 'uuid'
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
					const measureGroup = v4()
					return Object.entries(m.v)
						.map(([k, v]) =>
							r({
								name: `${name}.${k}`,
								v,
								ts,
								measureGroup,
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
