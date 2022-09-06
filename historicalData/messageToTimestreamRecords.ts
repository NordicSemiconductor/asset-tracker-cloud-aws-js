import { _Record } from '@aws-sdk/client-timestream-write'
import { toRecord } from '@nordicsemiconductor/timestream-helpers'
import { v4 } from 'uuid'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'

export const messageToTimestreamRecords = (event: DeviceMessage): _Record[] => {
	const Records: (_Record | undefined)[] = []
	if (event.message.btn !== undefined) {
		Records.push(
			toRecord({
				name: 'btn',
				ts: event.message.btn.ts,
				v: event.message.btn.v,
				dimensions: { measureGroup: v4() },
			}),
		)
	}

	/**/
	if (event.message.magnitude !== undefined) {
		Records.push(
			toRecord({
				name: 'magnitude',
				ts: event.message.magnitude.ts,
				v: event.message.magnitude.v,
				dimensions: { measureGroup: v4() },
			}),
		)
	}

	return Records.filter(isNotNullOrUndefined) as _Record[]
}
