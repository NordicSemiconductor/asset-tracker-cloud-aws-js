import {
	regexGroupMatcher,
	regexMatcher,
	type InterpolatedStep,
	type StepRunnerFunc,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { randomWords } from '@nordicsemiconductor/random-words'
import { expect } from 'chai'
import { promises as fs } from 'fs'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate.js'
import { createSimulatorKeyAndCSR } from '../../cli/jitp/createSimulatorKeyAndCSR.js'
import { getCurrentCA } from '../../cli/jitp/currentCA.js'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations.js'
import {
	awsIotDeviceConnection,
	type ListenerWithPayload,
} from './awsIotDeviceConnection.js'

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
		regexGroupMatcher(
			/^the tracker(?: "(?<deviceId>[^"]+)")? receives (?<messageCount>a|[1-9][0-9]*) (?<raw>raw )?messages? on the topic (?<topic>[^ ]+)(?: into "(?<storeName>[^"]+)")?$/,
		)(async ({ deviceId, messageCount, raw, topic, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)
			const isRaw = raw !== undefined

			const expectedMessageCount =
				messageCount === 'a' ? 1 : parseInt(messageCount as string, 10)
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
					connection.onMessageOnce(topic as string, listener).catch(catchError)
				}
				connection.onMessageOnce(topic as string, listener).catch(catchError)
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const connection = await connectToBroker(catId)

			const job = runner.store[storeName as string]
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
						runner.store[storeName as string] = JSON.parse(message.toString())
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
