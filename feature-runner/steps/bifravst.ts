import {
	regexGroupMatcher,
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import { randomWords } from '@bifravst/random-words'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate'
import * as path from 'path'
import { device, thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import { expect } from 'chai'
import { isNotNullOrUndefined } from '../../util/isNullOrUndefined'
import { promises as fs } from 'fs'

const connect = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}) => (clientId: string) => {
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId: clientId,
	})
	return new device({
		privateKey: deviceFiles.key,
		clientCert: deviceFiles.certWithCA,
		caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		clientId,
		host: mqttEndpoint,
		region: mqttEndpoint.split('.')[2],
	})
}

const shadow = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}) => (clientId: string) => {
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId: clientId,
	})
	return new thingShadow({
		privateKey: deviceFiles.key,
		clientCert: deviceFiles.certWithCA,
		caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		clientId,
		host: mqttEndpoint,
		region: mqttEndpoint.split('.')[2],
	})
}

export const bifravstStepRunners = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => {
	const connectToBroker = connect({
		mqttEndpoint,
		certsDir,
	})
	const shadowOnBroker = shadow({
		mqttEndpoint,
		certsDir,
	})
	return [
		regexMatcher<BifravstWorld>(
			/^(?:a cat exists|I generate a certificate)(?: for the cat tracker "([^"]+)")?$/,
		)(async ([deviceId], __, runner) => {
			const catId = deviceId ?? (await randomWords({ numWords: 3 })).join('-')
			const prefix = deviceId === undefined ? 'cat' : `cat:${catId}`
			if (runner.store[`${prefix}:id`] === undefined) {
				await createDeviceCertificate({
					deviceId: catId,
					certsDir,
					log: (...message: any[]) => {
						// eslint-disable-next-line @typescript-eslint/no-floating-promises
						runner.progress('IoT (cert)', ...message)
					},
					debug: (...message: any[]) => {
						// eslint-disable-next-line @typescript-eslint/no-floating-promises
						runner.progress('IoT (cert)', ...message)
					},
				})
				const deviceFiles = deviceFileLocations({
					certsDir,
					deviceId: catId,
				})
				runner.store[`${prefix}:privateKey`] = await fs.readFile(
					deviceFiles.key,
					'utf-8',
				)
				runner.store[`${prefix}:clientCert`] = await fs.readFile(
					deviceFiles.certWithCA,
					'utf-8',
				)

				// eslint-disable-next-line require-atomic-updates
				runner.store[`${prefix}:id`] = catId
				// eslint-disable-next-line require-atomic-updates
				runner.store[
					`${prefix}:arn`
				] = `arn:aws:iot:${runner.world.region}:${runner.world.accountId}:thing/${catId}`
			}
			return runner.store[`${prefix}:id`]
		}),
		regexMatcher<BifravstWorld>(/^I connect the cat tracker(?: ([^ ]+))?$/)(
			async ([deviceId], __, runner) => {
				const catId = deviceId ?? runner.store['cat:id']
				await runner.progress('IoT', catId)
				const deviceFiles = deviceFileLocations({
					certsDir,
					deviceId: catId,
				})
				await runner.progress('IoT', `Connecting ${catId} to ${mqttEndpoint}`)

				return new Promise((resolve, reject) => {
					const timeout = setTimeout(reject, 60 * 1000)
					const connection = new thingShadow({
						privateKey: deviceFiles.key,
						clientCert: deviceFiles.certWithCA,
						caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
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
						reject()
						connection.end()
					})
				})
			},
		),
		regexMatcher<BifravstWorld>(
			/^the cat tracker(?: ([^ ]+))? updates its reported state with$/,
		)(async ([deviceId], step, runner) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const catId = deviceId ?? runner.store['cat:id']
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
		regexMatcher<BifravstWorld>(
			/^the cat tracker(?: ([^ ]+))? publishes this message to the topic ([^ ]+)$/,
		)(async ([deviceId, topic], step, runner) => {
			const catId = deviceId ?? runner.store['cat:id']
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const message = JSON.parse(step.interpolatedArgument)
			const connection = connectToBroker(catId)
			const publishPromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection.on('error', (err: any) => {
					clearTimeout(timeout)
					reject(err)
				})
				connection.publish(topic, JSON.stringify(message), undefined, (err) => {
					if (isNotNullOrUndefined(err)) {
						return reject(err)
					}
					clearTimeout(timeout)
					resolve()
				})
			})
			return await publishPromise
		}),
		regexGroupMatcher(
			/^the cat tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['cat:id']

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
			/^the cat tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['cat:id']
			const job = runner.store[storeName]
			expect(job).to.not.be.an('undefined')

			return new Promise((resolve, reject) => {
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
