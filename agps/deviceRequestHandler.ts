import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import { SQSEvent, SQSMessageAttributes } from 'aws-lambda'
import { isRight } from 'fp-ts/lib/These'
import { TextEncoder } from 'util'
import { v4 } from 'uuid'
import { fromEnv } from '../util/fromEnv'
import { cacheKey } from './cacheKey'
import { AGPSDataCache, getCache } from './getCache'
import { Static } from '@sinclair/typebox'
import { agpsRequestSchema } from './types'

const { binHoursString, TableName, QueueUrl, stateMachineArn } = fromEnv({
	binHoursString: 'BIN_HOURS',
	TableName: 'CACHE_TABLE',
	QueueUrl: 'QUEUE_URL',
	stateMachineArn: 'STATE_MACHINE_ARN',
})(process.env)

const binHours = parseInt(binHoursString, 10)

const dynamodb = new DynamoDBClient({})

const c = getCache({
	dynamodb,
	TableName,
})

type AGPSRequestFromIoTRule = Static<typeof agpsRequestSchema> & {
	deviceId: string
	updatedAt: string
}

const iotData = new IoTDataPlaneClient({})

const sqs = new SQSClient({})

const sf = new SFNClient({})

// Keep a local cache in case many devices requests the same location
const resolvedRequests: Record<string, AGPSDataCache> = {}

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	const deviceRequests = event.Records.map(({ body, messageAttributes }) => ({
		request: JSON.parse(body),
		messageAttributes,
	})) as {
		messageAttributes: SQSMessageAttributes
		request: AGPSRequestFromIoTRule
	}[]
	console.log(JSON.stringify({ deviceRequests }))

	// Group requests by cacheKey
	const byCacheKey = deviceRequests.reduce(
		(grouped, deviceRequest) => {
			const k = cacheKey({ request: deviceRequest.request, binHours })
			if (grouped[k] === undefined) {
				grouped[k] = [deviceRequest]
			} else {
				grouped[k].push(deviceRequest)
			}
			return grouped
		},
		{} as Record<
			string,
			{
				messageAttributes: SQSMessageAttributes
				request: AGPSRequestFromIoTRule
			}[]
		>,
	)

	// Resolve data
	await Promise.all(
		Object.entries(byCacheKey).map(
			async ([cacheKey, deviceRequests]): Promise<void> => {
				if (resolvedRequests[cacheKey] === undefined) {
					console.debug(cacheKey, 'Load from DB')
					const d = await c(cacheKey)
					if (isRight(d)) {
						if (d.right?.unresolved !== undefined) {
							console.debug(cacheKey, 'Processing of the request is finished')
							resolvedRequests[cacheKey] = d.right
							if (d.right.unresolved === true) {
								console.error(cacheKey, `A-GPS request is unresolved.`)
								return
							}
						}
					} else {
						console.debug(cacheKey, 'cache does not exist')
						console.warn({ getCache: d.left })
						const r = deviceRequests[0].request
						await Promise.all([
							// Create DB entry
							await dynamodb
								.send(
									new PutItemCommand({
										TableName,
										Item: {
											cacheKey: {
												S: cacheKey,
											},
											nw: {
												S: `${r.nw}`,
											},
											mcc: {
												N: `${r.mcc}`,
											},
											mnc: {
												N: `${r.mnc}`,
											},
											cell: {
												N: `${r.cell}`,
											},
											area: {
												N: `${r.area}`,
											},
											phycell:
												r.phycell !== undefined
													? {
															N: `${r.phycell}`,
													  }
													: { NULL: true },
											types: {
												NS: r.types.map((t) => `${t}`),
											},
											updatedAt: {
												S: new Date().toISOString(),
											},
											ttl: {
												N: `${
													Math.round(Date.now() / 1000) + binHours * 60 * 60
												}`,
											},
										},
									}),
								)
								.then(() => {
									console.debug(cacheKey, 'Cache entry created')
								}),
							await sf
								.send(
									new StartExecutionCommand({
										stateMachineArn,
										input: JSON.stringify({
											cacheKey,
											...r,
										}),
										name: cacheKey, // This will ensure only one is executed per invocation
									}),
								)
								.then((res) => {
									console.debug(
										cacheKey,
										'Resolution started',
										res.executionArn,
									)
								})
								.catch((err) => {
									// FIXME: handle (supress) expected errors (duplicate execution)
									console.error(
										JSON.stringify({
											startExecutionError: err.message,
										}),
									)
								}),
						])
					}
				}

				// The data for these requests is available
				if (
					resolvedRequests[cacheKey]?.unresolved !== undefined &&
					resolvedRequests[cacheKey].unresolved === false
				) {
					console.debug(cacheKey, 'data for these requests is available')
					console.debug(
						JSON.stringify({
							deviceRequests,
							resolvedRequests,
						}),
					)
					await Promise.all(
						deviceRequests.map(async (deviceRequest) =>
							Promise.all(
								(resolvedRequests[cacheKey]?.data ?? []).map(async (agpsdata) =>
									iotData.send(
										new PublishCommand({
											topic: `${deviceRequest.request.deviceId}/agps`,
											payload: new TextEncoder().encode(agpsdata),
											qos: 1,
										}),
									),
								),
							),
						),
					)
						.then(() => {
							deviceRequests.forEach(({ request: { deviceId } }) =>
								console.debug(cacheKey, `resolved request for`, deviceId),
							)
						})
						.catch((err) => {
							console.error(
								JSON.stringify({
									resolveRequestsViaIot: err.message,
								}),
							)
						})
					return
				}

				// Resolution is in progress ... put request in queue again, with increasing delay
				// Eventually, messages will be discarded from the queue
				await sqs
					.send(
						new SendMessageBatchCommand({
							QueueUrl,
							Entries: deviceRequests.map((deviceRequest) => {
								const DelaySeconds = Math.floor(
									Math.min(
										900,
										parseInt(
											deviceRequest.messageAttributes.DelaySeconds
												?.stringValue ?? '10',
											10,
										) * 1.5,
									),
								)
								return {
									Id: v4(),
									MessageBody: JSON.stringify(deviceRequest.request),
									DelaySeconds,
									MessageAttributes: {
										DelaySeconds: {
											DataType: 'Number',
											StringValue: `${DelaySeconds}`,
										},
									},
								}
							}),
						}),
					)
					.then(() => {
						deviceRequests.forEach(({ request: { deviceId } }) =>
							console.debug(cacheKey, `re-scheduled request for`, deviceId),
						)
					})
					.catch((err) => {
						console.error(
							JSON.stringify({
								batchSchedule: err.message,
							}),
						)
					})
			},
		),
	)
}
