import { _Record } from '@aws-sdk/client-timestream-write'
import { v4 } from 'uuid'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined.js'
import { toRecord } from './toRecord.js'
import {
	BatchMessage,
	NumbersAndStringsValueSensor,
	NumbersValueSensor,
} from './types.js'

export const batchToTimestreamRecords = (event: BatchMessage): _Record[] => {
	const Records: (_Record | undefined)[] = Object.entries(event.batch)
		.map(([name, messages]) =>
			(messages as (NumbersValueSensor | NumbersAndStringsValueSensor)[])
				?.map((m) => {
					const ts = m.ts
					const measureGroup = v4()
					return Object.entries(m.v)
						.map(([k, v]) =>
							toRecord({
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

	return Records.filter(isNotNullOrUndefined) as _Record[]
}
