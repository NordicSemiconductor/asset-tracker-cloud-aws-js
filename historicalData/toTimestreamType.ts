import { MeasureValueType } from '@aws-sdk/client-timestream-write'

export const toTimestreamType = (v: unknown): MeasureValueType => {
	if (typeof v === 'string') return MeasureValueType.VARCHAR
	if (typeof v === 'boolean') return MeasureValueType.BOOLEAN
	if (Number.isInteger(v)) return MeasureValueType.DOUBLE
	return MeasureValueType.DOUBLE
}
