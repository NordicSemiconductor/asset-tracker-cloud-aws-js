import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'
import {
	IoTDataPlaneClient,
	PublishCommand,
} from '@aws-sdk/client-iot-data-plane'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import {
	SQSClient,
	SendMessageBatchCommand,
	type SendMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs'
import type { Static } from '@sinclair/typebox'
import type { SQSEvent, SQSMessageAttributes } from 'aws-lambda'
import { randomUUID } from 'node:crypto'
import { fromEnv } from '../util/fromEnv.js'
import { cacheKey } from './cacheKey.js'
import { getCache, type AGNSSDataCache } from './getCache.js'
import type { agnssRequestSchema } from './types.js'

const {
	binHoursString,
	TableName,
	QueueUrl,
	stateMachineArn,
	initialDelayString,
	delayFactorString,
	maxResolutionTimeInMinutes,
} = fromEnv({
	binHoursString: 'BIN_HOURS',
	TableName: 'CACHE_TABLE',
	QueueUrl: 'QUEUE_URL',
	stateMachineArn: 'STATE_MACHINE_ARN',
	initialDelayString: 'INITIAL_DELAY',
	delayFactorString: 'DELAY_FACTOR',
	maxResolutionTimeInMinutes: 'MAX_RESOLUTION_TIME_IN_MINUTES',
})({
	INITIAL_DELAY: '5',
	DELAY_FACTOR: '1.5',
	...process.env,
})

const binHours = parseInt(binHoursString, 10)
const delayFactor = parseFloat(delayFactorString)
const initialDelay = parseInt(initialDelayString, 10)
const maxResolutionTimeInSeconds = parseInt(maxResolutionTimeInMinutes, 10) * 60

const dynamodb = new DynamoDBClient({})

const c = getCache({
	dynamodb,
	TableName,
})

type AGNSSRequestFromIoTRule = Static<typeof agnssRequestSchema> & {
	deviceId: string
	timestamp: string
}

const iotData = new IoTDataPlaneClient({})

const sqs = new SQSClient({})

const sf = new SFNClient({})

// Keep a local cache in case many devices requests the same location
const resolvedRequests: Record<string, AGNSSDataCache> = {}

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	const deviceRequests = event.Records.map(({ body, messageAttributes }) => ({
		request: JSON.parse(body),
		messageAttributes,
	})) as {
		messageAttributes: SQSMessageAttributes
		request: AGNSSRequestFromIoTRule
	}[]
	console.log(JSON.stringify({ deviceRequests }))

	// Group requests by cacheKey
	const byCacheKey = deviceRequests.reduce(
		(grouped, deviceRequest) => {
			const k = cacheKey({ request: deviceRequest.request, binHours })
			if (grouped[k] === undefined) {
				grouped[k] = [deviceRequest]
			} else {
				grouped[k]?.push(deviceRequest)
			}
			return grouped
		},
		{} as Record<
			string,
			{
				messageAttributes: SQSMessageAttributes
				request: AGNSSRequestFromIoTRule
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
					if ('error' in d) {
						console.debug(cacheKey, 'cache does not exist')
						console.warn({ getCache: d })
						const r = deviceRequests[0]?.request
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
											mcc: {
												N: `${r?.mcc}`,
											},
											mnc: {
												N: `${r?.mnc}`,
											},
											cell: {
												N: `${r?.cell}`,
											},
											area: {
												N: `${r?.area}`,
											},
											phycell:
												r?.phycell !== undefined
													? {
															N: `${r.phycell}`,
														}
													: { NULL: true },
											types: {
												NS: r?.types.map((t) => `${t}`) ?? [],
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
											startExecutionError: (err as Error).message,
										}),
									)
								}),
						])
					} else {
						if (d.unresolved !== undefined) {
							console.debug(cacheKey, 'Processing of the request is finished')
							resolvedRequests[cacheKey] = d
							if (d.unresolved === true) {
								console.error(cacheKey, `A-GNSS request is unresolved.`)
								return
							}
						}
					}
				}

				// The data for these requests is available
				if (
					resolvedRequests[cacheKey]?.unresolved !== undefined &&
					resolvedRequests[cacheKey]?.unresolved === false
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
								(resolvedRequests[cacheKey]?.dataHex ?? []).map(
									async (agnssdata) => {
										console.log(
											`Sending ${agnssdata.length} bytes to ${deviceRequest.request.deviceId}`,
										)
										return iotData.send(
											new PublishCommand({
												topic: `${deviceRequest.request.deviceId}/agnss`,
												payload: Buffer.from(agnssdata, 'hex'),
												qos: 1,
											}),
										)
									},
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
									resolveRequestsViaIot: (err as Error).message,
								}),
							)
						})
					return
				}

				// Resolution is in progress ... put request in queue again, with increasing delay
				// Eventually, messages will be discarded from the queue
				const Entries: SendMessageBatchRequestEntry[] = deviceRequests
					.filter((deviceRequest) => {
						const requestStarted = new Date(deviceRequest.request.timestamp)
						const ageInSeconds = Math.floor(
							(Date.now() - requestStarted.getTime()) / 1000,
						)
						const cancelRequest = ageInSeconds > maxResolutionTimeInSeconds
						if (cancelRequest) {
							console.error(
								`Cancelling request because of resolution timeout after ${ageInSeconds} seconds.`,
							)
							console.error(
								JSON.stringify(
									{
										cancelled: deviceRequest.request,
										maxResolutionTimeInSeconds,
									},
									null,
									2,
								),
							)
						}
						return !cancelRequest
					})
					.map((deviceRequest) => {
						const DelaySeconds = Math.floor(
							Math.min(
								900,
								(deviceRequest.messageAttributes.DelaySeconds?.stringValue ===
								undefined
									? initialDelay
									: parseInt(
											deviceRequest.messageAttributes.DelaySeconds.stringValue,
											10,
										)) * delayFactor,
							),
						)
						return {
							Id: randomUUID(),
							MessageBody: JSON.stringify(deviceRequest.request),
							DelaySeconds,
							MessageAttributes: {
								DelaySeconds: {
									DataType: 'Number',
									StringValue: `${DelaySeconds}`,
								},
							},
						}
					})
				if (Entries.length > 0)
					await sqs
						.send(
							new SendMessageBatchCommand({
								QueueUrl,
								Entries,
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
									batchSchedule: (err as Error).message,
								}),
							)
						})
			},
		),
	)
}
