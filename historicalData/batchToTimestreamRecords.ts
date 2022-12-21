import { _Record } from '@aws-sdk/client-timestream-write'
import { toRecord } from '@nordicsemiconductor/timestream-helpers'
import { randomUUID } from 'node:crypto'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined'

export const batchToTimestreamRecords = (event: BatchMessage): _Record[] => {
	const Records: (_Record | undefined)[] = Object.entries(event.batch)
		.map(([name, messages]) =>
			(
				messages as (
					| NumberValueSensor
					| NumbersValueSensor
					| NumbersAndStringsValueSensor
				)[]
			)
				?.map((m) => {
					const ts = m.ts
					const measureGroup = randomUUID()
					if (typeof m.v === 'number') {
						return toRecord({
							name: name,
							v: m.v,
							ts,
							dimensions: { measureGroup },
						})
					}
					return Object.entries(m.v)
						.map(([k, v]) =>
							toRecord({
								name: `${name}.${k}`,
								v,
								ts,
								dimensions: { measureGroup },
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
