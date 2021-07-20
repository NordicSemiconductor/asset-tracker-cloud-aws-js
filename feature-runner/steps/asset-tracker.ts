import {
	regexGroupMatcher,
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { randomWords } from '@nordicsemiconductor/random-words'
import { createDeviceCertificate } from '../../cli/jitp/createDeviceCertificate'
import { mqtt, io, iot, iotshadow, iotjobs } from 'aws-iot-device-sdk-v2'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'
import { expect } from 'chai'
import { readFileSync } from 'fs'

io.enable_logging(
	process.env.IOT_LOG_LEVEL === undefined
		? io.LogLevel.ERROR
		: parseInt(process.env.IOT_LOG_LEVEL, 10),
)
const clientBootstrap = new io.ClientBootstrap()

const awsIotThingMQTTConnection = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}) => {
	const connections: Record<
		string,
		{
			connection: mqtt.MqttClientConnection
			shadow: iotshadow.IotShadowClient
		}
	> = {}
	return async (
		clientId: string,
	): Promise<{
		connection: mqtt.MqttClientConnection
		shadow: iotshadow.IotShadowClient
	}> => {
		if (connections[clientId] === undefined) {
			console.debug(`Creating new connection for ${clientId}...`)
			const deviceFiles = deviceFileLocations({
				certsDir,
				deviceId: clientId,
			})
			const { privateKey, clientCert } = JSON.parse(
				readFileSync(deviceFiles.json, 'utf-8'),
			)
			const cfg = iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder(
				clientCert,
				privateKey,
			)
			cfg.with_clean_session(true)
			cfg.with_client_id(clientId)
			cfg.with_endpoint(mqttEndpoint)
			const client = new mqtt.MqttClient(clientBootstrap)
			const connection = client.new_connection(cfg.build())
			try {
				await connection.connect()
				connections[clientId] = {
					connection,
					shadow: new iotshadow.IotShadowClient(connection),
				}
			} catch (err) {
				console.error('XXX')
			}
		}

		return connections[clientId]
	}
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
	const iotConnect = awsIotThingMQTTConnection({
		mqttEndpoint,
		certsDir,
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
		}),
		regexMatcher<World>(/^I connect the tracker(?: "([^"]+)")?$/)(
			async ([deviceId], __, runner) => {
				const catId = deviceId ?? runner.store['tracker:id']
				await runner.progress(
					'IoT > connect',
					`Connecting ${catId} to ${mqttEndpoint} ...`,
				)
				await iotConnect(catId)
				await runner.progress(
					'IoT < connect',
					`Connected ${catId} to ${mqttEndpoint} ...`,
				)
			},
		),
		regexMatcher<World>(/^I disconnect the tracker(?: "([^"]+)")?$/)(
			async ([deviceId], __, runner) => {
				const catId = deviceId ?? runner.store['tracker:id']
				const { connection } = await iotConnect(catId)
				await runner.progress('IoT > disconnect')
				await connection.disconnect()
				await new Promise((resolve) => setTimeout(resolve, 5000, []))
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
			const { connection, shadow } = await iotConnect(catId)

			const updatePromise = await new Promise((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				const onError = (err: any) => {
					console.error(err)
					clearTimeout(timeout)
					reject(err)
				}
				connection.on('error', onError)
				shadow
					.subscribeToUpdateShadowAccepted(
						{
							thingName: catId,
						},
						mqtt.QoS.AtLeastOnce,
						async (error, response) => {
							if (error !== undefined) {
								return onError(error)
							}
							await runner.progress(
								'IoT < status',
								JSON.stringify(response?.state),
							)
							clearTimeout(timeout)
							resolve(response?.state)
						},
					)
					.then(async () =>
						runner.progress('IoT > reported', JSON.stringify(reported)),
					)
					.then(async () =>
						shadow.publishUpdateShadow(
							{
								thingName: catId,
								state: { reported },
							},
							mqtt.QoS.AtLeastOnce,
						),
					)
					.catch(reject)
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
			const { connection } = await iotConnect(catId)
			const publishPromise = new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(reject, 10 * 1000)
				connection.on('error', (err: any) => {
					clearTimeout(timeout)
					reject(err)
				})
				connection
					.publish(topic, message, mqtt.QoS.AtLeastOnce)
					.then(async () => resolve())
					.catch(reject)
			})
			return publishPromise
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? fetches the next job into "(?<storeName>[^"]+)"$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const { connection } = await iotConnect(catId)
			const jobsClient = new iotjobs.IotJobsClient(connection)

			return new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error(`Did not receive a next job!`))
				}, 60 * 1000)

				connection.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
				})

				jobsClient
					.subscribeToGetPendingJobExecutionsAccepted(
						{
							thingName: catId,
						},
						mqtt.QoS.AtLeastOnce,
						(error, job) => {
							if (error !== undefined) {
								clearTimeout(timeout)
								return reject(error)
							}
							clearTimeout(timeout)
							runner.store[storeName] = job
							resolve(job)
						},
					)
					.then(async () =>
						jobsClient.publishGetPendingJobExecutions(
							{
								thingName: catId,
							},
							mqtt.QoS.AtLeastOnce,
						),
					)
					.catch(reject)
			})
		}),
		regexGroupMatcher(
			/^the tracker(?: (?<deviceId>[^ ]+))? marks the job in "(?<storeName>[^"]+)" as in progress$/,
		)(async ({ deviceId, storeName }, _, runner) => {
			const catId = deviceId ?? runner.store['tracker:id']
			const job = runner.store[storeName]
			expect(job).to.not.be.an('undefined')
			const { connection } = await iotConnect(catId)
			const jobsClient = new iotjobs.IotJobsClient(connection)

			return new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Timeout'))
				}, 60 * 1000)

				connection.on('error', (error) => {
					clearTimeout(timeout)
					reject(error)
				})

				jobsClient
					.subscribeToUpdateJobExecutionAccepted(
						{
							jobId: job.jobId,
							thingName: catId,
						},
						mqtt.QoS.AtLeastOnce,
						async (error, update) => {
							if (error !== undefined) {
								clearTimeout(timeout)
								return reject(error)
							}
							await runner.progress('Iot (job)', JSON.stringify(update))
							resolve()
						},
					)
					.then(async () =>
						jobsClient.publishUpdateJobExecution(
							{
								jobId: job.jobId,
								thingName: catId,
								status: iotjobs.model.JobStatus.IN_PROGRESS,
								expectedVersion: job.versionNumber,
								executionNumber: job.executionNumber,
							},
							mqtt.QoS.AtLeastOnce,
						),
					)
					.catch(reject)
			})
		}),
	]
}
