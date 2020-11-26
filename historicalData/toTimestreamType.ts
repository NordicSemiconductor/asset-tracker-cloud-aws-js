import { TimestreamWrite } from 'aws-sdk'

export const toTimestreamType = (
	v: unknown,
): TimestreamWrite.MeasureValueType => {
	if (typeof v === 'string') return 'VARCHAR'
	if (typeof v === 'boolean') return 'BOOLEAN'
	if (Number.isInteger(v)) return 'DOUBLE'
	return 'DOUBLE'
}
