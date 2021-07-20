import {
	regexGroupMatcher,
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { randomWords } from '@nordicsemiconductor/random-words'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate'
import { device, thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import { expect } from 'chai'
import { isNotNullOrUndefined } from '../../util/isNullOrUndefined'
import { readFileSync } from 'fs'

const connect = ({
	mqttEndpoint,
	certsDir,
	awsIotRootCA,
}: {
	mqttEndpoint: string
	certsDir: string
	awsIotRootCA: string
}) => {
	const connections: Record<string, device> = {}
	return (clientId: string) => {
		if (connections[clientId] === undefined) {
			const deviceFiles = deviceFileLocations({
				certsDir,
				deviceId: clientId,
			})
			const { privateKey, clientCert } = JSON.parse(
				readFileSync(deviceFiles.json, 'utf-8'),
			)
			connections[clientId] = new device({
				privateKey: Buffer.from(privateKey),
				clientCert: Buffer.from(clientCert),
				caCert: Buffer.from(awsIotRootCA),
				clientId,
				host: mqttEndpoint,
				region: mqttEndpoint.split('.')[2],
			})
		}
		return connections[clientId]
	}
}

const shadow =
	({
		mqttEndpoint,
		certsDir,
		awsIotRootCA,
	}: {
		mqttEndpoint: string
		certsDir: string
		awsIotRootCA: string
	}) =>
	(clientId: string) => {
		const deviceFiles = deviceFileLocations({
			certsDir,
			deviceId: clientId,
		})
		const { privateKey, clientCert } = JSON.parse(
			readFileSync(deviceFiles.json, 'utf-8'),
		)
		return new thingShadow({
			privateKey: Buffer.from(privateKey),
			clientCert: Buffer.from(clientCert),
			caCert: Buffer.from(awsIotRootCA),
			clientId,
			host: mqttEndpoint,
			region: mqttEndpoint.split('.')[2],
		})
	}

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
	const connectToBroker = connect({
		mqttEndpoint,
		certsDir,
		awsIotRootCA,
	})
	const shadowOnBroker = shadow({
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
				await createDeviceCertificate({
					deviceId: catId,
					certsDir,
					mqttEndpoint,
					awsIotRootCA,
					log: (...message: any[]) => {
						// eslint-disable-next-line @typescript-eslint/no-floating-promises
						runner.progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						// eslint-disable-next-line @typescript-eslint/no-floating-promises
						runner.progress('IoT (cert)', ...message)
					},
					daysValid: 1,
				})
				const deviceFiles = deviceFileLocations({
					certsDir,
					deviceId: catId,
				})
				const { privateKey, clientCert } = JSON.parse(
					readFileSync(deviceFiles.json, 'utf-8'),
				)
				runner.store[`${prefix}:privateKey`] = privateKey
				runner.store[`${prefix}:clientCert`] = clientCert

				// eslint-disable-next-line require-atomic-updates
				runner.store[`${prefix}:id`] = catId
				// eslint-disable-next-line require-atomic-updates
				runner.store[`${prefix}:arn`] = `arn:aws:iot:${
					mqttEndpoint.split('.')[2]
				}:${runner.world.accountId}:thing/${catId}`
			}
			return runner.store[`${prefix}:id`]
		}),
		regexMatcher<World>(/^I connect the tracker(?: "([^"]+)")?$/)(
			async ([deviceId], __, runner) => {
				const catId = deviceId ?? runner.store['tracker:id']
				await runner.progress('IoT', catId)
				const deviceFiles = deviceFileLocations({
					certsDir,
					deviceId: catId,
				})
				await runner.progress('IoT', `Connecting ${catId} to ${mqttEndpoint}`)

				return new Promise((resolve, reject) => {
					const timeout = setTimeout(reject, 60 * 1000)
					const { privateKey, clientCert } = JSON.parse(
						readFileSync(deviceFiles.json, 'utf-8'),
					)
					const connection = new thingShadow({
						privateKey: Buffer.from(privateKey),
						clientCert: Buffer.from(clientCert),
						caCert: Buffer.from(awsIotRootCA),
						clientId: catId,
						host: mqttEndpoint,
						region: mqttEndpoint.split('.')[2],
					})

					connection.on('connect', () => {
						// eslint-disable-next-line require-atomic-updates
						clearTimeout(timeout)
						resolve([catId, mqttEndpoint])
						connection.end()
					})
					connection.on('error', () => {
						clearTimeout(timeout)
						reject(new Error('disconnected'))
						connection.end()
					})
				})
			},
		),
		regexMatcher<World>(
			/^the tracker(?: ([^ ]+))? updates its reported state with$/,
		)(async ([deviceId], step, runner) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = shadowOnBroker(catId)
			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection.on(
					'status',
					async (
						_thingName: string,
						stat: string,
						_clientToken: string,
						stateObject: Record<string, any>,
					) => {
						await runner.progress('IoT < status', stat)
						await runner.progress('IoT < status', JSON.stringify(stateObject))
						if (stat === 'accepted') {
							clearTimeout(timeout)
							resolve(stateObject)
							connection.end()
						}
					},
				)
				connection.on('error', (err: any) => {
					console.error(err)
					clearTimeout(timeout)
					reject(err)
					connection.end()
				})
				connection.register(catId, {}, async () => {
					await runner.progress('IoT > reported', catId)
					await runner.progress('IoT > reported', JSON.stringify(reported))
					connection.update(catId, { state: { reported } })
				})
			})
			return await updatePromise
		}),
		regexMatcher<World>(
			/^the tracker(?: ([^ ]+))? publishes this message to the topic ([^ ]+)$/,
		)(async ([deviceId, topic], step, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const message = JSON.parse(step.interpolatedArgument)
			const connection = connectToBroker(catId)
			const publishPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection.on('error', (err: any) => {
					clearTimeout(timeout)
					reject(err)
					connection.end()
				})
				connection.publish(topic, JSON.stringify(message), undefined, (err) => {
					if (isNotNullOrUndefined(err)) {
						return reject(err)
					}
					clearTimeout(timeout)
					resolve()
					connection.end()
				})
			})
			return publishPromise
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? receives (?<messageCount>a|[1-9][0-9]*) (?<raw>raw )?messages? on the topic (?<topic>[^ ]+)(?: into "(?<storeName>[^"]+)")?$/,
		)(async ({ deviceId, messageCount, raw, topic, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']

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
				const connection = connectToBroker(catId)

				connection.on('connect', () => {
					connection.subscribe(topic, undefined, (err) => {
						if (isNotNullOrUndefined(err)) {
							connection.end()
							reject(err)
						}
					})

					connection.on('message', async (t, message) => {
						await runner.progress(`Iot`, t)
						await runner.progress(`Iot`, message)
						if (t === topic) {
							const m = raw !== undefined ? message : JSON.parse(message)
							messages.push(m)
							if (messages.length === expectedMessageCount) {
								connection.unsubscribe(topic)
								connection.end()
								clearTimeout(timeout)
								// eslint-disable-next-line require-atomic-updates
								if (storeName !== undefined)
									runner.store[storeName] =
										messages.length > 1 ? messages : messages[0]
								resolve(messages.length > 1 ? messages : messages[0])
							}
						}
					})
				})
				connection.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
					connection.end()
				})
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 60 * 1000)
				const connection = connectToBroker(catId)

				const successTopic = `$aws/things/${catId}/jobs/$next/get/accepted`

				connection.on('connect', () => {
					clearTimeout(timeout)
					connection.subscribe(successTopic, undefined, (err) => {
						if (isNotNullOrUndefined(err)) {
							connection.end()
							reject(err)
						}
						connection.publish(
							`$aws/things/${catId}/jobs/$next/get`,
							'',
							undefined,
							(err) => {
								if (isNotNullOrUndefined(err)) {
									connection.end()
									reject(err)
								}
							},
						)
					})

					connection.on('message', async (topic, message) => {
						connection.unsubscribe(successTopic)
						connection.end()
						await runner.progress('Iot (job)', topic)
						await runner.progress('Iot (job)', message)
						const { execution } = JSON.parse(message)
						if (topic === successTopic && isNotNullOrUndefined(execution)) {
							// eslint-disable-next-line require-atomic-updates
							runner.store[storeName] = execution
							resolve(execution)
							connection.end()
						} else {
							reject(new Error(`Did not receive a next job!`))
							connection.end()
						}
					})
				})
				connection.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
					connection.end()
				})
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const job = runner.store[storeName]
			expect(job).to.not.be.an('undefined')

			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(reject, 60 * 1000)
				const connection = connectToBroker(catId)

				connection.on('connect', () => {
					clearTimeout(timeout)
					connection.subscribe(
						`$aws/things/${catId}/jobs/${job.jobId}/update/accepted`,
					)
					connection.publish(
						`$aws/things/${catId}/jobs/${job.jobId}/update`,
						JSON.stringify({
							status: 'IN_PROGRESS',
							expectedVersion: job.versionNumber,
							executionNumber: job.executionNumber,
						}),
						undefined,
						(err) => {
							if (err) {
								connection.end()
								reject(err)
							}
						},
					)
				})
				connection.on('message', async (topic, payload) => {
					await runner.progress('Iot (job)', topic)
					await runner.progress('Iot (job)', payload)
					connection.unsubscribe(
						`$aws/things/${catId}/jobs/${job.jobId}/update/accepted`,
					)
					connection.end()
					resolve()
				})
				connection.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
					connection.end()
				})
			})
		}),
	]
}
