import { TimestreamWrite } from 'aws-sdk'

export const storeRecordsInTimeseries = ({
	timestream,
	DatabaseName,
	TableName,
}: {
	timestream: TimestreamWrite
	DatabaseName: string
	TableName: string
}) => async (Records: TimestreamWrite.Records): Promise<void> => {
	if (Records.length === 0) {
		console.log({
			storeRecordsInTimeseries: 'No records to store.',
		})
		return
	}
	const args = {
		DatabaseName,
		TableName,
		Records,
	}
	const request = timestream.writeRecords(args)
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
