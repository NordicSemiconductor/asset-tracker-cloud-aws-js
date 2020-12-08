import { TimestreamWrite } from 'aws-sdk'

export const storeRecordsInTimeseries = ({
	timestream,
	DatabaseName,
	TableName,
}: {
	timestream: TimestreamWrite
	DatabaseName: string
	TableName: string
}) => async (
	Records: TimestreamWrite.Records,
	commonAttributes?: TimestreamWrite.Record,
): Promise<void> => {
	if (Records.length === 0) {
		console.warn(
			JSON.stringify({
				storeRecordsInTimeseries: 'No records to store.',
			}),
		)
		return
	}
	const request = timestream.writeRecords({
		DatabaseName,
		TableName,
		Records,
		CommonAttributes: commonAttributes,
	})
	try {
		await request.promise()
	} catch (err) {
		const RejectedRecords = JSON.parse(
			(request as any).response.httpResponse.body.toString(),
		).RejectedRecords
		if (RejectedRecords !== undefined) {
			console.error({
				RejectedRecords,
			})
		}
		throw new Error(`${err.code}: ${err.message}`)
	}
}
