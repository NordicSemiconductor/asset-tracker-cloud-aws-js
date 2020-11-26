import { toTimestreamType } from './toTimestreamType'
import { TimestreamWrite } from 'aws-sdk'

export const toRecord = (Dimensions: TimestreamWrite.Dimensions) => ({
	name,
	ts,
	v,
}: {
	name: string
	ts: number
	v?: any
}): TimestreamWrite.Record | undefined => {
	if (v === undefined) return
	return {
		Dimensions,
		MeasureName: name,
		MeasureValue: v.toString(),
		MeasureValueType: toTimestreamType(v),
		Time: ts.toString(),
	}
}
