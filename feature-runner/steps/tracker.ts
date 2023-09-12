import {
	codeBlockOrThrow,
	type StepRunner,
	regExpMatchedStep,
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
import {
	awsIotDeviceConnection,
	type Connection,
} from './awsIotDeviceConnection.js'
import { aString, check, objectMatching } from 'tsmatchers'

type TrackerInfo = {
	privateKey: string
	clientCert: string
	id: string
	arn: string
}

const trackers: Record<string, TrackerInfo> = {}
const connections: Record<string, Connection> = {}

const steps: ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}) => StepRunner<
	World & {
		tracker?: Record<string, TrackerInfo>
		connection?: Connection
	} & Record<string, any>
>[] = ({ certsDir, mqttEndpoint }) => [
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
		async ({
			match: { trackerId: maybeTrackerId },
			context,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				const deviceId = (await randomWords({ numWords: 3 })).join('-')
				await createSimulatorKeyAndCSR({
					deviceId,
					certsDir,
					log: (...message: any[]) => {
						progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						progress('IoT (cert)', ...message)
					},
				})
				await createDeviceCertificate({
					deviceId,
					certsDir,
					caId: getCurrentCA({ certsDir }),
					log: (...message: any[]) => {
						progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						progress('IoT (cert)', ...message)
					},
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
		async ({
			match: { trackerId: maybeTrackerId },
			context,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No certificate available for tracker ${trackerId}`)
			}

			if (connections[trackerId] === undefined) {
				const deviceId = (trackers[trackerId] as TrackerInfo).id
				progress('IoT', `Connecting ${deviceId} to ${mqttEndpoint}`)
				const connection = await awsIotDeviceConnection({
					awsIotRootCA: context.awsIotRootCA,
					certsDir,
					mqttEndpoint,
				})(deviceId)

				connections[trackerId] = await new Promise((resolve, reject) => {
					const timeout = setTimeout(async () => {
						progress('IoT', `Connection timeout`)
						reject(new Error(`Connection timeout`))
					}, 60 * 1000)

					connection.onConnect(() => {
						progress('IoT', 'Connected')
						clearTimeout(timeout)
						resolve(connection)
					})
				})
			}
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
		async ({ match: { trackerId: maybeTrackerId }, log: { progress } }) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}

			connections[trackerId]?.close()
			delete connections[trackerId]
			progress('Closed')
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
		async ({
			match: { trackerId: maybeTrackerId },
			step,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}

			const reported = JSON.parse(codeBlockOrThrow(step).code)
			const deviceId = (trackers[trackerId] as TrackerInfo).id
			const connection = connections[trackerId] as Connection
			const shadowBase = `$aws/things/${deviceId}/shadow`
			const updateStatus = `${shadowBase}/update`
			const updateStatusAccepted = `${updateStatus}/accepted`
			const updateStatusRejected = `${updateStatus}/rejected`

			progress(`IoT < subscribing to: ${updateStatusAccepted}`)
			connection.subscribe(updateStatusAccepted)

			progress(`IoT < subscribing to: ${updateStatusRejected}`)
			connection.subscribe(updateStatusRejected)

			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error(`Timed out!`)),
					10 * 1000,
				)

				connection.onMessage((topic, message) => {
					switch (topic) {
						case updateStatusAccepted:
							progress('IoT < status', message.toString())
							clearTimeout(timeout)
							resolve(JSON.parse(message.toString()))
							break
						case updateStatusRejected:
							progress('IoT < status', message.toString())
							clearTimeout(timeout)
							reject(new Error(`Update rejected!`))
							break
					}
				})

				progress(`IoT > publishing to ${updateStatus}`)
				progress(`IoT > ${JSON.stringify(reported)}`)
				connection
					.publish(updateStatus, JSON.stringify({ state: { reported } }))
					.catch(() => {
						clearTimeout(timeout)
						reject(new Error(`Failed to publish`))
					})
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
		async ({
			match: { trackerId: maybeTrackerId, topic },
			step,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const message = JSON.parse(codeBlockOrThrow(step).code)
			progress(`IoT Publishing > ${topic}`)
			progress(`IoT Publishing > ${JSON.stringify(message)}`)
			const connection = connections[trackerId] as Connection
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error(`Timed out!`)),
					10 * 1000,
				)
				connection
					.publish(topic, JSON.stringify(message))
					.then(resolve)
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
				)})? tracker fetches the next job into ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				trackerId: Type.Optional(Type.String()),
				storageName: Type.String(),
			}),
		},
		async ({
			match: { trackerId: maybeTrackerId, storageName },
			context,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const connection = connections[trackerId] as Connection

			const deviceId = (trackers[trackerId] as TrackerInfo).id

			const getNextJobTopic = `$aws/things/${deviceId}/jobs/$next/get`
			const successTopic = `${getNextJobTopic}/accepted`

			const res = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Did not receive a next job!`))
				}, 10 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				progress(`IoT Job < subscribing to ${successTopic}`)
				connection.subscribe(successTopic)

				connection.onMessage((topic, message) => {
					if (topic !== successTopic) return
					if (JSON.parse(message.toString()).execution?.jobId === undefined)
						return
					progress(`IoT Job < ${message.toString()}`)
					clearTimeout(timeout)
					resolve(JSON.parse(message.toString()).execution)
				})

				connection.publish(getNextJobTopic, '').catch(catchError)
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
				)})? tracker marks the job in ${matchString(
					'storageName',
				)} as in progress$`,
			),
			schema: Type.Object({
				trackerId: Type.Optional(Type.String()),
				storageName: Type.String(),
			}),
		},
		async ({
			match: { trackerId: maybeTrackerId, storageName },
			context,
			log: { progress },
		}) => {
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const connection = connections[trackerId] as Connection

			const deviceId = (trackers[trackerId] as TrackerInfo).id

			const updateJobTopic = `$aws/things/${deviceId}/jobs/${context[storageName].jobId}/update`
			const successTopic = `${updateJobTopic}/accepted`

			await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Job not marked as in progress!`))
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				progress(`IoT Job < subscribing to ${successTopic}`)
				connection.subscribe(successTopic)

				connection.onMessage((topic, message) => {
					if (topic !== successTopic) return
					progress(message.toString())
					clearTimeout(timeout)
					resolve(JSON.parse(message.toString()))
				})

				progress(`IoT Job > publishing to ${updateJobTopic}`)
				connection
					.publish(
						updateJobTopic,
						JSON.stringify({
							status: 'IN_PROGRESS',
							expectedVersion: context[storageName].versionNumber,
							executionNumber: context[storageName].executionNumber,
						}),
					)
					.catch(catchError)
			})
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
			log: { progress },
		}) => {
			const isRaw = raw !== undefined
			const trackerId = maybeTrackerId ?? 'default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const connection = connections[trackerId] as Connection

			const expectedMessageCount =
				messageCount === 'a' ? 1 : parseInt(messageCount.slice(1, -1), 10)
			const messages: (Record<string, any> | string)[] = []

			progress(`subscribing to ${topic}`)
			connection.subscribe(topic)

			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(
						new Error(
							`timed out with ${
								expectedMessageCount - messages.length
							} message${expectedMessageCount > 1 ? 's' : ''} yet to receive.`,
						),
					)
				}, 10 * 1000)

				connection.onMessage((t, message) => {
					if (topic !== t) return
					const m = isRaw
						? message.toString('hex')
						: JSON.parse(message.toString('utf-8'))
					messages.push(m)
					progress(`IoT < received message on ${topic}`)
					progress(`IoT < ${JSON.stringify(m)}`)
					if (messages.length === expectedMessageCount) {
						clearTimeout(timeout)

						const result = messages.length > 1 ? messages : messages[0]

						if (storageName !== undefined) context[storageName] = result

						return resolve()
					}
				})
			})
		},
	),
]
export default steps
