import { toTimestreamType } from './toTimestreamType'
import { _Record } from '@aws-sdk/client-timestream-write'

export const toRecord = ({
	name,
	ts,
	v,
	measureGroup,
}: {
	name: string
	ts: number
	v?: any
	measureGroup: string
}): _Record | undefined => {
	if (v === undefined) return
	return {
		Dimensions: [
			{
				Name: 'measureGroup',
				Value: measureGroup,
			},
		],
		MeasureName: name,
		MeasureValue: v.toString(),
		MeasureValueType: toTimestreamType(v),
		Time: ts.toString(),
	}
}
