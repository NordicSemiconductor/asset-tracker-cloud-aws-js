import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchStep, matchString } from './util.js'
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
import { aNumber, aString, check, objectMatching } from 'tsmatchers'

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
		tracker?: TrackerInfo
		connection?: Connection
	}
>[] = ({ certsDir, mqttEndpoint }) => [
	matchStep(
		new RegExp(
			`^I generate a certificate(:? for the tracker ${matchString(
				'deviceId',
			)})?$`,
		),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
		}),
		async (
			{ deviceId: maybeDeviceId },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const deviceId =
				maybeDeviceId ?? (await randomWords({ numWords: 3 })).join('-')
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
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
				trackers[trackerId] = {
					privateKey: privateKey,
					clientCert: clientCert,
					id: deviceId,
					arn: `arn:aws:iot:${mqttEndpoint.split('.')[2]}:${
						context.accountId
					}:thing/${deviceId}`,
				}
			}
			context.tracker = trackers[trackerId]
			return { result: trackers[trackerId]?.id }
		},
	),
	matchStep(
		new RegExp(`^I connect the tracker(:? ${matchString('deviceId')})?$`),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
		}),
		async (
			{ deviceId: maybeDeviceId },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No certificate available for tracker ${trackerId}`)
			}

			if (connections[trackerId] === undefined) {
				const deviceId = trackers[trackerId].id
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

			return { result: trackers[trackerId]?.id }
		},
	),
	matchStep(
		new RegExp(`^I disconnect the tracker(:? ${matchString('deviceId')})?$`),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
		}),
		async (
			{ deviceId: maybeDeviceId },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}

			connections[trackerId]?.close()
			delete connections[trackerId]
			progress('Closed')

			context.tracker = undefined
		},
	),
	matchStep(
		new RegExp(
			`^the tracker(:? ${matchString(
				'deviceId',
			)})? updates its reported state with$`,
		),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
		}),
		async (
			{ deviceId: maybeDeviceId },
			{
				step,
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}

			const reported = JSON.parse(codeBlockOrThrow(step).code)
			const deviceId = trackers[trackerId].id
			const connection = connections[trackerId]
			const shadowBase = `$aws/things/${deviceId}/shadow`
			const updateStatus = `${shadowBase}/update`
			const updateStatusAccepted = `${updateStatus}/accepted`
			const updateStatusRejected = `${updateStatus}/rejected`

			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				Promise.all([
					connection.onMessageOnce(updateStatusAccepted, (message) => {
						progress('IoT < status', message.toString())
						clearTimeout(timeout)
						resolve(JSON.parse(message.toString()))
					}),
					connection.onMessageOnce(updateStatusRejected, (message) => {
						progress('IoT < status', message.toString())
						clearTimeout(timeout)
						reject(new Error(`Update rejected!`))
					}),
				])
					.then(async () => {
						progress('IoT > reported', deviceId)
						progress('IoT > reported', JSON.stringify(reported))
						return connection.publish(
							updateStatus,
							JSON.stringify({ state: { reported } }),
						)
					})
					.catch((err) => {
						clearTimeout(timeout)
						reject(err)
					})
			})
			return { result: await updatePromise }
		},
	),
	matchStep(
		new RegExp(
			`^the tracker(:? ${matchString(
				'deviceId',
			)})? publishes this message to the topic ${matchString('topic')}$`,
		),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
			topic: Type.String(),
		}),
		async (
			{ deviceId: maybeDeviceId, topic },
			{
				step,
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const message = JSON.parse(codeBlockOrThrow(step).code)
			progress(JSON.stringify(message))
			const connection = connections[trackerId]
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection
					.publish(topic as string, JSON.stringify(message))
					.then(resolve)
					.catch(reject)
					.finally(() => {
						clearTimeout(timeout)
					})
			})
		},
	),
	matchStep(
		new RegExp(
			`^the tracker(:? ${matchString(
				'deviceId',
			)})? fetches the next job into ${matchString('storageName')}$`,
		),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
			storageName: Type.String(),
		}),
		async (
			{ deviceId: maybeDeviceId, storageName },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const connection = connections[trackerId]

			const deviceId = trackers[trackerId].id

			const getNextJobTopic = `$aws/things/${deviceId}/jobs/$next/get`
			const successTopic = `${getNextJobTopic}/accepted`

			progress(getNextJobTopic)
			progress(successTopic)

			const res = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Did not receive a next job!`))
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				connection
					.onMessageOnce(successTopic, (message) => {
						progress(message.toString())
						clearTimeout(timeout)
						resolve(JSON.parse(message.toString()).execution)
					})
					.catch(catchError)

				connection.publish(getNextJobTopic, '').catch(catchError)
			})

			progress(JSON.stringify(res))

			check(res).is(
				objectMatching({
					jobId: aString,
				}),
			)

			context[storageName] = res

			return { result: res }
		},
	),
	matchStep(
		new RegExp(
			`^the tracker(:? ${matchString(
				'deviceId',
			)})? marks the job in ${matchString('storageName')} as in progress$`,
		),
		Type.Object({
			deviceId: Type.Optional(Type.String()),
			storageName: Type.String(),
		}),
		async (
			{ deviceId: maybeDeviceId, storageName },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const trackerId = maybeDeviceId ?? '__default'
			if (trackers[trackerId] === undefined) {
				throw new Error(`No credentials available for tracker ${trackerId}`)
			}
			if (connections[trackerId] === undefined) {
				throw new Error(`No connection available for tracker ${trackerId}`)
			}
			const connection = connections[trackerId]

			const deviceId = trackers[trackerId].id

			const updateJobTopic = `$aws/things/${deviceId}/jobs/${context[storageName].jobId}/update`
			const successTopic = `${updateJobTopic}/accepted`

			progress(updateJobTopic)
			progress(successTopic)

			const res = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Job not marked as in progress!`))
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				connection
					.onMessageOnce(successTopic, (message) => {
						progress(message.toString())
						clearTimeout(timeout)
						resolve(JSON.parse(message.toString()))
					})
					.catch(catchError)

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

			progress(JSON.stringify(res))

			return { result: res }
		},
	),
]
export default steps
