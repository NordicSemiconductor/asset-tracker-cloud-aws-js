import {
	regexMatcher,
	regexGroupMatcher,
	StepRunner,
} from '@coderbyheart/bdd-feature-runner-aws'
import { BifravstWorld } from '../run-features'
import { randomWords } from '@bifravst/random-words'
import { generateDeviceCertificate } from '../../cli/jitp/generateDeviceCertificate'
import * as path from 'path'
import { thingShadow, device } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import * as uuid from 'uuid'
import * as jsonata from 'jsonata'
import { expect } from 'chai'

export const bifravstStepRunners = ({
	mqttEndpoint,
}: {
	mqttEndpoint: string
}): StepRunner<BifravstWorld>[] => [
	regexMatcher(/^(?:a cat exists|I generate a certificate)$/)(
		async (_, __, runner) => {
			if (!runner.store['cat:id']) {
				const catName = (await randomWords({ numWords: 3 })).join('-')

				await generateDeviceCertificate({
					endpoint: mqttEndpoint,
					deviceId: catName,
					certsDir: path.resolve(process.cwd(), 'certificates'),
					caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
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
	regexMatcher(
		/^(?:I connect the cat tracker(?: ([^ ]+))?|the cat tracker(?: ([^ ]+))? is connected)$/,
	)(async ([deviceId1, deviceId2], __, runner) => {
		const catId = deviceId1 || deviceId2 || runner.store['cat:id']
		await runner.progress('IoT', catId)
		if (!runner.store[`cat:connection:${catId}`]) {
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
					runner.store[`cat:connection:${catId}`] = connection
					clearTimeout(timeout)
					resolve([catId, mqttEndpoint])
				})
				connection.on('error', () => {
					clearTimeout(timeout)
					reject()
				})
			})
		}
	}),
	regexMatcher(
		/^the cat tracker(?: ([^ ]+))? updates its reported state with$/,
	)(async ([deviceId], step, runner) => {
		if (!step.interpolatedArgument) {
			throw new Error('Must provide argument!')
		}
		const reported = JSON.parse(step.interpolatedArgument)
		const catId = deviceId || runner.store['cat:id']
		const connection = runner.store[`cat:connection:${catId}`]
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
					}
				},
			)
			connection.on('error', (err: any) => {
				clearTimeout(timeout)
				reject(err)
			})
			connection.register(catId, {}, async () => {
				await runner.progress('IoT > reported', catId)
				await runner.progress('IoT > reported', JSON.stringify(reported))
				connection.update(catId, { state: { reported } })
			})
		})
		return await updatePromise
	}),
	regexMatcher(
		/^the cat tracker(?: ([^ ]+))? publishes this message to the topic ([^ ]+)$/,
	)(async ([deviceId, topic], step, runner) => {
		const catId = deviceId || runner.store['cat:id']
		if (!step.interpolatedArgument) {
			throw new Error('Must provide argument!')
		}
		const message = JSON.parse(step.interpolatedArgument)
		const connection = runner.store[`cat:connection:${catId}`]
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
	regexGroupMatcher(/I store a UUIDv4 as "(?<storeName>[^"]+)"/)(
		async ({ storeName }, _, runner) => {
			runner.store[storeName] = uuid.v4()
			return runner.store[storeName]
		},
	),
	regexGroupMatcher(
		/^the cat tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
	)(async ({ deviceId, storeName }, _, runner) => {
		const catId = deviceId || runner.store['cat:id']
		const connection = runner.store[`cat:connection:${catId}`]
		runner.store[`cat:connection:${catId}`] = undefined
		if (connection) {
			connection.end()
		}

		const deviceFiles = deviceFileLocations({
			certsDir: path.resolve(process.cwd(), 'certificates'),
			deviceId: catId,
		})

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(reject, 60 * 1000)
			const connection = new device({
				privateKey: deviceFiles.key,
				clientCert: deviceFiles.certWithCA,
				caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
				clientId: catId,
				host: mqttEndpoint,
				region: mqttEndpoint.split('.')[2],
				debug: true,
			})

			connection.on('connect', () => {
				clearTimeout(timeout)
				connection.subscribe(
					`$aws/things/${catId}/jobs/$next/get/accepted`,
					undefined,
					err => {
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
					},
				)

				connection.on('message', (_, message) => {
					connection.end()
					const job = JSON.parse(message.toString())
					runner.store[storeName] = job
					resolve(job)
				})
			})
			connection.on('error', error => {
				clearTimeout(timeout)
				reject(error)
			})
		})
	}),
	regexGroupMatcher(
		/^(?:"(?<exp>[^"]+)" of )?"(?<storeName>[^"]+)" (?<equalOrMatch>equal|match) this JSON$/,
	)(async ({ exp, equalOrMatch, storeName }, step, runner) => {
		if (!step.interpolatedArgument) {
			throw new Error('Must provide argument!')
		}
		const j = JSON.parse(step.interpolatedArgument)
		const result = runner.store[storeName]
		const fragment = exp ? jsonata(exp).evaluate(result) : result
		if (equalOrMatch === 'match') {
			expect(fragment).to.containSubset(j)
		} else {
			expect(fragment).to.deep.equal(j)
		}
		return [fragment]
	}),
]
