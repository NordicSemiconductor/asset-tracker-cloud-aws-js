import { _Record } from '@aws-sdk/client-timestream-write'
import { v4 } from 'uuid'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'
import { toRecord } from './toRecord'

export const messageToTimestreamRecords = (event: DeviceMessage): _Record[] => {
	const Records: (_Record | undefined)[] = []
	if (event.message.btn !== undefined) {
		Records.push(
			toRecord({
				name: 'btn',
				ts: event.message.btn.ts,
				v: event.message.btn.v,
				measureGroup: v4(),
			}),
		)
	}

	return Records.filter(isNotNullOrUndefined) as _Record[]
}
