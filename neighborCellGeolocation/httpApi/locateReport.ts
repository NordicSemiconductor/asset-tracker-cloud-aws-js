import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { Type } from '@sinclair/typebox'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as E from 'fp-ts/lib/Either'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo'
import { res } from '../../api/res'
import { validateWithJSONSchemaFP } from '../../api/validateWithJSONSchemaFP'
import { Location } from '../../geolocation/Location'
import { queueJob } from '../../geolocation/queueJob'
import { fromEnv } from '../../util/fromEnv'
import { geolocateReport } from '../geolocateReport'

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

const validateInput = validateWithJSONSchemaFP(inputSchema)

export const handler = async (
	event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
	console.log(JSON.stringify(event))

	const valid = validateInput(event.pathParameters ?? {})
	if (E.isLeft(valid))
		return res(toStatusCode[ErrorType.BadRequest])(valid.left)()

	const report = await locator(valid.right.id)()
	if (E.isLeft(report)) {
		if (report.left.type === ErrorType.EntityNotFound) {
			return res(toStatusCode[report.left.type], {
				expires: 86400,
			})({
				type: ErrorType.EntityNotFound,
				message: `neighbor cell geolocation not found!`,
			})()
		}
		return res(toStatusCode[report.left.type], {
			expires: 60,
		})(report.left)()
	}

	console.log(JSON.stringify({ report: report.right }))

	if ('location' in report.right) {
		const l = report.right.location as Location
		return res(200, {
			expires: 86400,
		})(l)()
	}

	if (report.right?.unresolved === true) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: 'Neighbor cell geolocation could not be resolved',
		})()
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
