import {
	_Record,
	TimestreamWriteClient,
	WriteRecordsCommand,
} from '@aws-sdk/client-timestream-write'

export const storeRecordsInTimeseries = ({
	timestream,
	DatabaseName,
	TableName,
}: {
	timestream: TimestreamWriteClient
	DatabaseName: string
	TableName: string
}) => async (Records: _Record[], CommonAttributes?: _Record): Promise<void> => {
	if (Records.length === 0) {
		console.warn(
			JSON.stringify({
				storeRecordsInTimeseries: 'No records to store.',
			}),
		)
		return
	}
	const request = timestream.send(
		new WriteRecordsCommand({
			DatabaseName,
			TableName,
			Records,
			CommonAttributes,
		}),
	)
	try {
		await request
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
