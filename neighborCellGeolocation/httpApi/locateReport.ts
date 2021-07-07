import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as E from 'fp-ts/lib/Either'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { toStatusCode, ErrorType } from '../../api/ErrorInfo'
import { res } from '../../api/res'
import { SQSClient } from '@aws-sdk/client-sqs'
import { fromEnv } from '../../util/fromEnv'
import { Type } from '@sinclair/typebox'
import { queueJob } from '../../geolocation/queueJob'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { geolocateReport } from '../geolocateReport'
import { Location } from '../../geolocation/Location'

const { neighborCellGeolocationResolutionJobsQueue, reportsTable } = fromEnv({
	neighborCellGeolocationResolutionJobsQueue:
		'NEIGHBOR_CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
	reportsTable: 'REPORTS_TABLE',
})(process.env)

const locator = geolocateReport({
	dynamodb: new DynamoDBClient({}),
	TableName: reportsTable,
})

const q = queueJob({
	QueueUrl: neighborCellGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

const inputSchema = Type.Object(
	{
		id: Type.String({ minLength: 1 }),
	},
	{ additionalProperties: false },
)

console.log(JSON.stringify(inputSchema, null, 2))

const validateInput = validateWithJSONSchema(inputSchema)

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	const valid = validateInput(event.pathParameters ?? {})
	if (E.isLeft(valid))
		return res(toStatusCode[ErrorType.BadRequest])(valid.left)()

	const report = await locator(valid.right.id)()
	if (E.isLeft(report)) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: `neighbor cell geolocation not found!`,
		})()
	}

	if ('location' in report.right) {
		const l = report.right.location as Location
		return res(200, {
			expires: 86400,
		})(l)()
	}

	await q({
		deduplicationId: valid.right.id,
		payload: report.right,
	})()

	return res(toStatusCode[ErrorType.Conflict], { expires: 60 })({
		type: ErrorType.Conflict,
		message: 'Calculation for neighbor cell geolocation in process',
	})()
}
