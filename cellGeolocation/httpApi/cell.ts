import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SQSClient } from '@aws-sdk/client-sqs'
import { validateWithType } from '@nordicsemiconductor/asset-tracker-cloud-docs'
import {
	cellId,
	NetworkMode,
} from '@nordicsemiconductor/cell-geolocation-helpers'
import { Type } from '@sinclair/typebox'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { ErrorType, toStatusCode } from '../../api/ErrorInfo.js'
import { res } from '../../api/res.js'
import { queueJob } from '../../geolocation/queueJob.js'
import { fromEnv } from '../../util/fromEnv.js'
import { geolocateFromCache } from '../geolocateFromCache.js'

const { cellGeolocationResolutionJobsQueue, cacheTable } = fromEnv({
	cellGeolocationResolutionJobsQueue: 'CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE',
	cacheTable: 'CACHE_TABLE',
})(process.env)

const locator = geolocateFromCache({
	dynamodb: new DynamoDBClient({}),
	TableName: cacheTable,
})

const q = queueJob({
	QueueUrl: cellGeolocationResolutionJobsQueue,
	sqs: new SQSClient({}),
})

const cellInputSchema = Type.Object(
	{
		nw: Type.Enum(NetworkMode),
		cell: Type.Number({
			minimum: 1,
		}),
		area: Type.Number({
			minimum: 1,
		}),
		mccmnc: Type.Number({
			minimum: 10000,
		}),
		// Allow cache busting
		ts: Type.Optional(
			Type.Number({
				minimum: 1,
			}),
		),
	},
	{ additionalProperties: false },
)

console.log(JSON.stringify(cellInputSchema, null, 2))

const validateInput = validateWithType(cellInputSchema)

const allMembersToInt = (o: Record<string, any>): Record<string, number> =>
	Object.entries(o).reduce(
		(o, [k, v]) => ({ ...o, [k]: v !== undefined ? parseInt(v, 10) : 0 }),
		{},
	)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify(event))

	const maybeValidInput = validateInput({
		...allMembersToInt(event.queryStringParameters ?? {}),
		nw: event?.queryStringParameters?.nw ?? '',
	})
	if ('errors' in maybeValidInput) {
		return res(toStatusCode[ErrorType.BadRequest])(maybeValidInput.errors)
	}
	const cell = await locator(maybeValidInput)

	if ('error' in cell) {
		const scheduled = await q({
			payload: cell,
			deduplicationId: cellId(maybeValidInput),
		})
		if (scheduled !== undefined && 'error' in scheduled) {
			return res(toStatusCode[scheduled.error.type], {
				expires: 60,
			})(scheduled.error)
		}
		return res(toStatusCode[ErrorType.Conflict], {
			expires: 60,
		})({
			type: ErrorType.Conflict,
			message: 'Calculation for cell geolocation in process',
		})
	}
	if (cell.unresolved) {
		return res(toStatusCode[ErrorType.EntityNotFound], {
			expires: 86400,
		})({
			type: ErrorType.EntityNotFound,
			message: `cell geolocation not found!`,
		})
	}
	return res(200, {
		expires: 86400,
	})({
		lat: cell.lat,
		lng: cell.lng,
		accuracy: cell.accuracy,
	})
}
