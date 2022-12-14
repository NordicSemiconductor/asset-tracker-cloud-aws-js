import {
	InterpolatedStep,
	regexGroupMatcher,
	regexMatcher,
	StepRunnerFunc,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { randomWords } from '@nordicsemiconductor/random-words'
import { expect } from 'chai'
import { promises as fs } from 'fs'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate'
import { createSimulatorKeyAndCSR } from '../../cli/jitp/createSimulatorKeyAndCSR'
import { getCurrentCA } from '../../cli/jitp/currentCA'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import {
	awsIotDeviceConnection,
	ListenerWithPayload,
} from './awsIotDeviceConnection'

type World = {
	accountId: string
}

export const assetTrackerStepRunners = ({
	mqttEndpoint,
	certsDir,
	awsIotRootCA,
}: {
	mqttEndpoint: string
	certsDir: string
	awsIotRootCA: string
}): ((step: InterpolatedStep) => StepRunnerFunc<World> | false)[] => {
	const connectToBroker = awsIotDeviceConnection({
		mqttEndpoint,
		certsDir,
		awsIotRootCA,
	})
	return [
		regexMatcher<World>(
			/^(?:I generate a certificate)(?: for the tracker "([^"]+)")?$/,
		)(async ([deviceId], __, runner) => {
			const catId = deviceId ?? (await randomWords({ numWords: 3 })).join('-')
			const prefix = deviceId === undefined ? 'tracker' : `tracker:${catId}`
			if (runner.store[`${prefix}:id`] === undefined) {
				await createSimulatorKeyAndCSR({
					deviceId: catId,
					certsDir,
					log: (...message: any[]) => {
						void runner.progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						void runner.progress('IoT (cert)', ...message)
					},
				})
				await createDeviceCertificate({
					deviceId: catId,
					certsDir,
					caId: getCurrentCA({ certsDir }),
					log: (...message: any[]) => {
						void runner.progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						void runner.progress('IoT (cert)', ...message)
					},
					daysValid: 1,
				})
				const deviceFiles = deviceFileLocations({
					certsDir,
					deviceId: catId,
				})
				const [privateKey, clientCert] = await Promise.all([
					fs.readFile(deviceFiles.key, 'utf-8'),
					fs.readFile(deviceFiles.certWithCA, 'utf-8'),
				])
				runner.store[`${prefix}:privateKey`] = privateKey
				runner.store[`${prefix}:clientCert`] = clientCert

				runner.store[`${prefix}:id`] = catId
				runner.store[`${prefix}:arn`] = `arn:aws:iot:${
					mqttEndpoint.split('.')[2]
				}:${runner.world.accountId}:thing/${catId}`
			}
			return runner.store[`${prefix}:id`]
		}),
		regexMatcher<World>(/^I connect the tracker(?: "([^"]+)")?$/)(
			async ([deviceId], __, runner) => {
				const catId = deviceId ?? runner.store['tracker:id']
				await runner.progress('IoT', `Connecting ${catId} to ${mqttEndpoint}`)
				const connection = await connectToBroker(catId)

				return new Promise((resolve, reject) => {
					const timeout = setTimeout(async () => {
						await runner.progress('IoT', `Connection timeout`)
						reject(new Error(`Connection timeout`))
					}, 60 * 1000)

					connection.onConnect(() => {
						clearTimeout(timeout)
						resolve([catId, mqttEndpoint])
					})
				})
			},
		),
		regexMatcher<World>(
			/^the tracker(?: "([^"]+)")? updates its reported state with$/,
		)(async ([deviceId], step, runner) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)
			const shadowBase = `$aws/things/${catId}/shadow`
			const updateStatus = `${shadowBase}/update`
			const updateStatusAccepted = `${updateStatus}/accepted`
			const updateStatusRejected = `${updateStatus}/rejected`

			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				Promise.all([
					connection.onMessageOnce(updateStatusAccepted, (message) => {
						void runner.progress('IoT < status', message.toString())
						clearTimeout(timeout)
						resolve(JSON.parse(message.toString()))
					}),
					connection.onMessageOnce(updateStatusRejected, (message) => {
						void runner.progress('IoT < status', message.toString())
						clearTimeout(timeout)
						reject(new Error(`Update rejected!`))
					}),
				])
					.then(async () => {
						void runner.progress('IoT > reported', catId)
						void runner.progress('IoT > reported', JSON.stringify(reported))
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
			return await updatePromise
		}),
		regexMatcher<World>(
			/^the tracker(?: "([^"]+)")? publishes this message to the topic ([^ ]+)$/,
		)(async ([deviceId, topic], step, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const message = JSON.parse(step.interpolatedArgument)
			const connection = await connectToBroker(catId)
			const publishPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection
					.publish(topic, JSON.stringify(message))
					.then(resolve)
					.catch(reject)
					.finally(() => {
						clearTimeout(timeout)
					})
			})
			return publishPromise
		}),
		regexGroupMatcher(
			/^the tracker(?: "(?<deviceId>[^"]+)")? receives (?<messageCount>a|[1-9][0-9]*) (?<raw>raw )?messages? on the topic (?<topic>[^ ]+)(?: into "(?<storeName>[^"]+)")?$/,
		)(async ({ deviceId, messageCount, raw, topic, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)
			const isRaw = raw !== undefined

			const expectedMessageCount =
				messageCount === 'a' ? 1 : parseInt(messageCount, 10)
			const messages: (Record<string, any> | string)[] = []

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(
						new Error(
							`timed out with ${
								expectedMessageCount - messages.length
							} message${expectedMessageCount > 1 ? 's' : ''} yet to receive.`,
						),
					)
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				const listener: ListenerWithPayload = async (message) => {
					await runner.progress(`Iot`, JSON.stringify(message))
					const m = isRaw
						? message.toString('hex')
						: JSON.parse(message.toString('utf-8'))
					messages.push(m)
					if (messages.length === expectedMessageCount) {
						clearTimeout(timeout)

						const result = messages.length > 1 ? messages : messages[0]

						if (storeName !== undefined) runner.store[storeName] = result

						if (isRaw) {
							if (messages.length > 1)
								return resolve(
									messages.map(
										(m) =>
											`(${
												Buffer.from(m as string, 'hex').length
											} bytes of data)`,
									),
								)
							return resolve(
								`(${
									Buffer.from(messages[0] as string, 'hex').length
								} bytes of data)`,
							)
						}

						return resolve(result)
					}
					connection.onMessageOnce(topic, listener).catch(catchError)
				}
				connection.onMessageOnce(topic, listener).catch(catchError)
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)

			const getNextJobTopic = `$aws/things/${catId}/jobs/$next/get`
			const successTopic = `${getNextJobTopic}/accepted`

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Did not receive a next job!`))
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				connection
					.onMessageOnce(successTopic, (message) => {
						clearTimeout(timeout)
						runner.store[storeName] = JSON.parse(message.toString()).execution
						resolve(runner.store[storeName])
					})
					.catch(catchError)

				connection.publish(getNextJobTopic, '').catch(catchError)
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)

			const job = runner.store[storeName]
			expect(job).to.not.be.an('undefined')

			const updateJobTopic = `$aws/things/${catId}/jobs/${job.jobId}/update`
			const successTopic = `${updateJobTopic}/accepted`

			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Job not marked as in progress!`))
				}, 60 * 1000)

				const catchError = (error: Error) => {
					clearTimeout(timeout)
					reject(error)
				}

				connection
					.onMessageOnce(successTopic, (message) => {
						clearTimeout(timeout)
						runner.store[storeName] = JSON.parse(message.toString())
						resolve(JSON.parse(message.toString()))
					})
					.then(async () =>
						connection.publish(
							updateJobTopic,
							JSON.stringify({
								status: 'IN_PROGRESS',
								expectedVersion: job.versionNumber,
								executionNumber: job.executionNumber,
							}),
						),
					)
					.catch(catchError)
			})
		}),
	]
}
