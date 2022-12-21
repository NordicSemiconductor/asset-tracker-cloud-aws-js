import { _Record } from '@aws-sdk/client-timestream-write'
import { toRecord } from '@nordicsemiconductor/timestream-helpers'
import { randomUUID } from 'node:crypto'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'

export const messageToTimestreamRecords = (event: DeviceMessage): _Record[] => {
	const Records: (_Record | undefined)[] = []
	if (event.message.btn !== undefined) {
		Records.push(
			toRecord({
				name: 'btn',
				ts: event.message.btn.ts,
				v: event.message.btn.v,
				dimensions: { measureGroup: randomUUID() },
			}),
		)
	}

	if (event.message.impact !== undefined) {
		Records.push(
			toRecord({
				name: 'impact',
				ts: event.message.impact.ts,
				v: event.message.impact.v,
				dimensions: { measureGroup: randomUUID() },
			}),
		)
	}

	return Records.filter(isNotNullOrUndefined) as _Record[]
}
