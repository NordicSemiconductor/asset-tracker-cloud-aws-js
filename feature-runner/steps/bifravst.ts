import {
	regexGroupMatcher,
	regexMatcher,
} from '@coderbyheart/bdd-feature-runner-aws'
import { BifravstWorld } from '../run-features'
import { randomWords } from '@bifravst/random-words'
import { generateDeviceCertificate } from '../../cli/jitp/generateDeviceCertificate'
import * as path from 'path'
import { device, thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import { expect } from 'chai'

const connect = (mqttEndpoint: string) => (clientId: string) => {
	const deviceFiles = deviceFileLocations({
		certsDir: path.resolve(process.cwd(), 'certificates'),
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

const shadow = (mqttEndpoint: string) => (clientId: string) => {
	const deviceFiles = deviceFileLocations({
		certsDir: path.resolve(process.cwd(), 'certificates'),
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
}: {
	mqttEndpoint: string
}) => {
	const connectToBroker = connect(mqttEndpoint)
	const shadowOnBroker = shadow(mqttEndpoint)
	return [
		regexMatcher<BifravstWorld>(/^(?:a cat exists|I generate a certificate)$/)(
			async (_, __, runner) => {
				if (!runner.store['cat:id']) {
					const catName = (await randomWords({ numWords: 3 })).join('-')

					await generateDeviceCertificate({
						deviceId: catName,
						certsDir: path.resolve(process.cwd(), 'certificates'),
						log: (...message: any[]) => {
							// eslint-disable-next-line @typescript-eslint/no-floating-promises
							runner.progress('IoT (cert)', ...message)
						},
						debug: (...message: any[]) => {
							// eslint-disable-next-line @typescript-eslint/no-floating-promises
							runner.progress('IoT (cert)', ...message)
						},
					})

					// eslint-disable-next-line require-atomic-updates
					runner.store['cat:id'] = catName
					// eslint-disable-next-line require-atomic-updates
					runner.store[
						'cat:arn'
					] = `arn:aws:iot:${runner.world.region}:${runner.world.accountId}:thing/${catName}`
				}
				return runner.store['cat:id']
			},
		),
		regexMatcher<BifravstWorld>(
			/^I connect the cat tracker(?: ([^ ]+))?$/,
		)(async ([deviceId], __, runner) => {
			const catId = deviceId || runner.store['cat:id']
			await runner.progress('IoT', catId)
			const deviceFiles = deviceFileLocations({
				certsDir: path.resolve(process.cwd(), 'certificates'),
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
		}),
		regexMatcher<BifravstWorld>(
			/^the cat tracker(?: ([^ ]+))? updates its reported state with$/,
		)(async ([deviceId], step, runner) => {
			if (!step.interpolatedArgument) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const catId = deviceId || runner.store['cat:id']
			const connection = shadowOnBroker(catId)
			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection.on(
					'status',
					async (
						_thingName: string,
						stat: string,
						_clientToken: string,
						stateObject: object,
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
			const catId = deviceId || runner.store['cat:id']
			if (!step.interpolatedArgument) {
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
				connection.publish(
					topic,
					JSON.stringify(message),
					undefined,
					(err: any) => {
						if (err) {
							return reject(err)
						}
						clearTimeout(timeout)
						resolve()
					},
				)
			})
			return await publishPromise
		}),
		regexGroupMatcher(
			/^the cat tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId || runner.store['cat:id']

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 60 * 1000)
				const connection = connectToBroker(catId)

				const successTopic = `$aws/things/${catId}/jobs/$next/get/accepted`

				connection.on('connect', () => {
					clearTimeout(timeout)
					connection.subscribe(successTopic, undefined, err => {
						if (err) {
							connection.end()
							reject(err)
						}
						connection.publish(
							`$aws/things/${catId}/jobs/$next/get`,
							'',
							undefined,
							err => {
								if (err) {
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
						if (topic === successTopic && execution) {
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
				connection.on('error', error => {
					clearTimeout(timeout)
					reject(error)
					connection.end()
				})
			})
		}),
		regexGroupMatcher(
			/^the cat tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId || runner.store['cat:id']
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
						err => {
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
				connection.on('error', error => {
					clearTimeout(timeout)
					reject(error)
					connection.end()
				})
			})
		}),
	]
}
