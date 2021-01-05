import { _Record } from '@aws-sdk/client-timestream-write'
import { v4 } from 'uuid'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'
import { toRecord } from './toRecord'

export const shadowUpdateToTimestreamRecords = (
	event: UpdatedDeviceState,
): _Record[] => {
	const measureGroup = v4()

	const Records: (_Record | undefined)[] = []
	if (event.reported.bat !== undefined) {
		Records.push(
			toRecord({
				name: 'bat',
				ts: event.reported.bat.ts,
				v: event.reported.bat.v,
				measureGroup,
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
					toRecord({
						name: `${s}.${k}`,
						v,
						ts,
						measureGroup,
					}),
				),
			)
		}
	})
	return Records.filter(isNotNullOrUndefined) as _Record[]
}
