import {
	codeBlockOrThrow,
	type StepRunner,
	regExpMatchedStep,
	type Logger,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchString } from './util.js'
import { randomWords } from '@nordicsemiconductor/random-words'
import { readFile } from 'node:fs/promises'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate.js'
import { createSimulatorKeyAndCSR } from '../../cli/jitp/createSimulatorKeyAndCSR.js'
import { getCurrentCA } from '../../cli/jitp/currentCA.js'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations.js'
import { mqtt, io, iot, iotshadow, iotjobs } from 'aws-iot-device-sdk-v2'
import { aString, check, objectMatching } from 'tsmatchers'
import { TextDecoder } from 'util'
import { readFileSync } from 'fs'
import { retry } from '../../cli/commands/retry.js'

const decoder = new TextDecoder('utf8')

io.enable_logging(
	process.env.AWS_IOT_SDK_LOG_LEVEL === undefined
		? io.LogLevel.ERROR
		: parseInt(process.env.AWS_IOT_SDK_LOG_LEVEL, 10),
)
const clientBootstrap = new io.ClientBootstrap()

const connect = async ({
	clientCert,
	privateKey,
	clientId,
	mqttEndpoint,
	logger,
}: {
	clientCert: string
	privateKey: string
	clientId: string
	mqttEndpoint: string
	logger: Logger
}) =>
	new Promise<mqtt.MqttClientConnection>((resolve, reject) => {
		const cfg = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
			clientCert,
			privateKey,
		)
		cfg.with_clean_session(true)
		cfg.with_client_id(clientId)
		cfg.with_endpoint(mqttEndpoint)
		const client = new mqtt.MqttClient(clientBootstrap)
		const connection = client.new_connection(cfg.build())
		connection.on('error', (err) => {
			logger.debug(JSON.stringify(err))
			reject(err)
		})
		connection.on('connect', () => {
			logger.progress(`${clientId} connected`)
			resolve(connection)
		})
		connection.on('disconnect', () => {
			logger.progress(`${clientId} disconnected`)
		})
		connection.on('closed', () => {
			logger.progress(`${clientId} closed`)
		})
		connection.connect().catch(() => {
			logger.debug(`${clientId} failed to connect.`)
		})
	})

const awsIotThingMQTTConnection = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}): ((
	clientId: string,
	logger: Logger,
) => Promise<mqtt.MqttClientConnection>) => {
	const connections: Record<string, Promise<mqtt.MqttClientConnection>> = {}
	return async (clientId, logger): Promise<mqtt.MqttClientConnection> => {
		const maybeConnection = connections[clientId]
		if (maybeConnection !== undefined) return maybeConnection
		const deviceFiles = deviceFileLocations({
			certsDir,
			deviceId: clientId,
		})
		const [privateKey, clientCert] = [
			readFileSync(deviceFiles.key, 'utf-8'),
			readFileSync(deviceFiles.certWithCA, 'utf-8'),
		]
		const connection = retry<mqtt.MqttClientConnection>(
			10,
			() => 5000,
		)(async () =>
			connect({
				clientCert,
				privateKey,
				clientId,
				mqttEndpoint,
				logger,
			}),
		)
		connections[clientId] = connection
		return connection
	}
}
type TrackerInfo = {
	privateKey: string
	clientCert: string
	id: string
	arn: string
}

const trackers: Record<string, TrackerInfo> = {}

const steps: ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}) => StepRunner<
	World & {
		tracker?: Record<string, TrackerInfo>
		connection?: mqtt.MqttClientConnection
	} & Record<string, any>
>[] = ({ certsDir, mqttEndpoint }) => {
	const iotConnect = awsIotThingMQTTConnection({
		mqttEndpoint,
		certsDir,
	})
	const messages: {
		trackerId: string
		topic: string
		payload: ArrayBuffer
	}[] = []
	return [
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^I generate a certificate for the(:? ${matchString(
						'trackerId',
					)})? tracker$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId }, context }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					const deviceId = randomWords({ numWords: 3 }).join('-')
					await createSimulatorKeyAndCSR({
						deviceId,
						certsDir,
					})
					await createDeviceCertificate({
						deviceId,
						certsDir,
						caId: getCurrentCA({ certsDir }),
						daysValid: 1,
					})
					const deviceFiles = deviceFileLocations({
						certsDir,
						deviceId,
					})
					const [privateKey, clientCert] = await Promise.all([
						readFile(deviceFiles.key, 'utf-8'),
						readFile(deviceFiles.certWithCA, 'utf-8'),
					])
					const info: TrackerInfo = {
						privateKey,
						clientCert,
						id: deviceId,
						arn: `arn:aws:iot:${mqttEndpoint.split('.')[2]}:${
							context.accountId
						}:thing/${deviceId}`,
					}
					trackers[trackerId] = info
					context.tracker = {
						...(context.tracker ?? {}),
						[trackerId]: info,
					}
				}
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^I connect the(:? ${matchString('trackerId')})? tracker$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId }, log }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No certificate available for tracker ${trackerId}`)
				}

				const deviceId = (trackers[trackerId] as TrackerInfo).id
				log.progress(`Connecting ${deviceId} to ${mqttEndpoint}`)
				await iotConnect(deviceId, log)
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^I disconnect the(:? ${matchString('trackerId')})? tracker$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId }, log }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No certificate available for tracker ${trackerId}`)
				}
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				const connection = await iotConnect(deviceId, log)
				log.progress(`${deviceId} disconnecting...`)
				try {
					await connection.disconnect()
					log.progress(`${deviceId} closed...`)
				} catch (err) {
					log.debug(`Failed closing connection: ${(err as Error).message}.`)
				}
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the(:? ${matchString(
						'trackerId',
					)})? tracker updates its reported state with$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId }, step, log }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No credentials available for tracker ${trackerId}`)
				}
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				const connection = await iotConnect(deviceId, log)
				const shadow = new iotshadow.IotShadowClient(connection)

				const reported = JSON.parse(codeBlockOrThrow(step).code)

				const updatePromise = await new Promise((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error('Timed out waiting for message!')),
						10 * 1000,
					)

					const onError = (err: any) => {
						log.error(err)
						clearTimeout(timeout)
						reject(err)
					}
					void shadow
						.subscribeToUpdateShadowAccepted(
							{
								thingName: deviceId,
							},
							mqtt.QoS.AtLeastOnce,
							async (error, response) => {
								if (error !== undefined) {
									return onError(error)
								}
								log.progress(`< status ${JSON.stringify(response?.state)}`)
								clearTimeout(timeout)
								resolve(response?.state)
							},
						)
						.then(() => log.progress(`> reported ${JSON.stringify(reported)}`))
						.then(async () =>
							shadow.publishUpdateShadow(
								{
									thingName: deviceId,
									state: { reported },
								},
								mqtt.QoS.AtLeastOnce,
							),
						)
						.catch(onError)
				})
				await updatePromise
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the(:? ${matchString(
						'trackerId',
					)})? tracker publishes this message to the topic ${matchString(
						'topic',
					)}$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
					topic: Type.String(),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId, topic }, step, log }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No credentials available for tracker ${trackerId}`)
				}
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				const connection = await iotConnect(deviceId, log)
				const message = JSON.parse(codeBlockOrThrow(step).code)
				log.progress(`> ${topic}`)
				log.progress(`> ${JSON.stringify(message)}`)
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(
						() => reject(new Error(`Timed out!`)),
						60 * 1000,
					)
					connection.on('error', (err: any) => {
						clearTimeout(timeout)
						reject(err)
					})
					connection
						.publish(topic, message, mqtt.QoS.AtLeastOnce)
						.then(async () => resolve())
						.catch(reject)
						.finally(() => {
							clearTimeout(timeout)
						})
				})
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the(:? ${matchString(
						'trackerId',
					)})? tracker stores the next started job into ${matchString(
						'storageName',
					)}$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
					storageName: Type.String(),
				}),
			},
			async ({
				match: { trackerId: maybeTrackerId, storageName },
				context,
				log,
			}) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No credentials available for tracker ${trackerId}`)
				}
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				const connection = await iotConnect(deviceId, log)
				const jobsClient = new iotjobs.IotJobsClient(connection)

				const res = await new Promise<{
					jobId: string // e.g. '97ce393b-2877-4b14-adb8-be2418acde02'
					status: string // e.g. 'IN_PROGRESS'
					versionNumber: number // e.g. 2
					executionNumber: number // e.g. 1
					jobDocument: Record<string, any>
				}>((resolve, reject) => {
					const timeout = setTimeout(() => {
						reject(new Error(`Did not receive a next job!`))
					}, 60 * 1000)
					let done = false

					connection.on('error', (error) => {
						clearTimeout(timeout)
						reject(error)
					})

					void jobsClient
						.subscribeToStartNextPendingJobExecutionAccepted(
							{
								thingName: deviceId,
							},
							mqtt.QoS.AtLeastOnce,
							(error, job) => {
								if (error !== undefined) {
									clearTimeout(timeout)
									return reject(error)
								}
								log.progress(
									`subscribeToStartNextPendingJobExecutionAccepted < ${JSON.stringify(
										job,
									)}`,
								)
								clearTimeout(timeout)
								done = true
								const jobId = job?.execution?.jobId
								if (jobId !== undefined) {
									resolve(job?.execution as any)
								}
							},
						)
						.then(async () =>
							jobsClient.subscribeToStartNextPendingJobExecutionRejected(
								{
									thingName: deviceId,
								},
								mqtt.QoS.AtLeastOnce,
								(error, rejected) => {
									if (error !== undefined) {
										clearTimeout(timeout)
										reject(error)
										return
									}
									clearTimeout(timeout)
									done = true
									reject(
										new Error(
											`subscribeToStartNextPendingJobExecutionRejected < ${JSON.stringify(
												rejected,
											)}`,
										),
									)
								},
							),
						)
						.then(async () => {
							let tries = 0
							while (!done && ++tries < 5) {
								await new Promise((resolve) =>
									setTimeout(resolve, tries * 1000),
								)
								void jobsClient
									.publishStartNextPendingJobExecution(
										{
											thingName: deviceId,
										},
										mqtt.QoS.AtLeastOnce,
									)
									.catch((err) => {
										done = true
										reject(err)
									})
							}
						})
				})

				check(res).is(
					objectMatching({
						jobId: aString,
					}),
				)

				context[storageName] = res
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the(:? ${matchString(
						'trackerId',
					)})? tracker receives (?<messageCount>a|\`[1-9][0-9]*\`) (?<raw>raw )?messages? on the topic ${matchString(
						'topic',
					)} into ${matchString('storageName')}$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
					messageCount: Type.String(),
					topic: Type.String(),
					storageName: Type.String(),
					raw: Type.Optional(Type.Literal('raw ')),
				}),
			},
			async ({
				match: {
					messageCount,
					topic,
					trackerId: maybeTrackerId,
					storageName,
					raw,
				},
				context,
			}) => {
				const isRaw = raw !== undefined
				const trackerId = maybeTrackerId ?? 'default'
				const expectedMessageCount =
					messageCount === 'a' ? 1 : parseInt(messageCount.slice(1, -1), 10)

				await retry(10)(async () => {
					const m = messages
						.filter(
							({ trackerId: tid, topic: t }) =>
								tid === trackerId && topic === t,
						)
						.map(({ payload }) => {
							const message = decoder.decode(payload)
							const m = isRaw
								? Buffer.from(payload).toString('hex')
								: JSON.parse(message)
							return m
						})
					check(m.length).is(expectedMessageCount)
					const result = expectedMessageCount > 1 ? m : m[0]

					if (storageName !== undefined) context[storageName] = result
				})
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the(:? ${matchString(
						'trackerId',
					)})? tracker is subscribed to the topic ${matchString('topic')}$`,
				),
				schema: Type.Object({
					trackerId: Type.Optional(Type.String()),
					topic: Type.String(),
				}),
			},
			async ({ match: { trackerId: maybeTrackerId, topic }, log }) => {
				const trackerId = maybeTrackerId ?? 'default'
				if (trackers[trackerId] === undefined) {
					throw new Error(`No certificate available for tracker ${trackerId}`)
				}
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				const connection = await iotConnect(deviceId, log)
				log.progress(`< subscribing to ${topic}`)
				void connection.subscribe(
					topic,
					mqtt.QoS.AtLeastOnce,
					async (topic: string, payload: ArrayBuffer) => {
						messages.push({
							payload,
							trackerId,
							topic,
						})
					},
				)
			},
		),
	]
}
export default steps
