import type { _Record } from '@aws-sdk/client-timestream-write'
import { toRecord } from '@nordicsemiconductor/timestream-helpers'
import { randomUUID } from 'node:crypto'
import { isNotNullOrUndefined } from '../util/isNullOrUndefined.js'

export const shadowUpdateToTimestreamRecords = (event: {
	reported: Record<
		string,
		{
			v: Record<
				string,
				{
					toString: () => string
				} | null
			>
			ts: number
		}
	>
}): _Record[] => {
	const measureGroup = randomUUID()

	const Records: (_Record | undefined)[] = []
	const props = Object.keys(event.reported).filter(
		(s) => !/^(cfg|bat)$/.test(s),
	) as (keyof Omit<UpdatedDeviceState['reported'], 'cfg' | 'bat'>)[]

	for (const s of props) {
		const v = event.reported[s]?.v
		if (v === undefined) continue
		const ts = event.reported[s]?.ts as number
		for (const [name, value] of Object.entries(v)) {
			if (value === null) continue
			Records.push(
				toRecord({
					name: `${s}.${name}`,
					v: value,
					ts,
					dimensions: { measureGroup },
				}),
			)
		}
	}
	return Records.filter(isNotNullOrUndefined) as _Record[]
}
