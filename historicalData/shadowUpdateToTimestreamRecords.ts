import { TimestreamWrite } from 'aws-sdk'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'
import { toRecord } from './toRecord'

export const shadowUpdateToTimestreamRecords = (
	event: UpdatedDeviceState,
): TimestreamWrite.Records => {
	const r = toRecord([
		{
			Name: 'deviceId',
			Value: event.deviceId,
		},
	])

	const Records: (TimestreamWrite.Record | undefined)[] = []
	if (event.reported.bat !== undefined) {
		Records.push(
			r({
				name: 'bat',
				ts: event.reported.bat.ts,
				v: event.reported.bat.v,
			}),
		)
	}

	const props = Object.keys(event.reported).filter(
		(s) => !/^(cfg|bat)$/.test(s),
	) as (keyof Omit<UpdatedDeviceState['reported'], 'cfg' | 'bat'>)[]

	props.map((s) => {
		const v = event.reported[s]?.v
		if (v !== undefined) {
			const ts = event.reported[s]?.ts as number
			Records.push(
				...Object.entries(v).map(([k, v]) =>
					r({
						name: `${s}.${k}`,
						v,
						ts,
					}),
				),
			)
		}
	})
	return Records.filter(isNotNullOrUndefined) as TimestreamWrite.Records
}
