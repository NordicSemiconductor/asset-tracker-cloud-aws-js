import { regexMatcher, StepRunner } from '@coderbyheart/bdd-feature-runner-aws'
import { BifravstWorld } from '../run-features'
import { randomWords } from '@bifravst/random-words'
import { generateDeviceCertificate } from '../../cli/jitp/generateDeviceCertificate'
import * as path from 'path'
import { thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'

export const bifravstStepRunners = ({
	mqttEndpoint,
}: {
	mqttEndpoint: string
}): StepRunner<BifravstWorld>[] => [
	{
		willRun: regexMatcher(/^(?:a cat exists|I generate a certificate)$/),
		run: async (_, __, runner) => {
			if (!runner.store['cat:id']) {
				const catName = (await randomWords({ numWords: 3 })).join('-')

				await generateDeviceCertificate({
					endpoint: mqttEndpoint,
					deviceId: catName,
					certsDir: path.resolve(process.cwd(), 'certificates'),
					caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
				})

				// eslint-disable-next-line require-atomic-updates
				runner.store['cat:id'] = catName
			}
			return runner.store['cat:id']
		},
	},
	{
		willRun: regexMatcher(
			/^(?:I connect the cat tracker(?: ([^ ]+))?|the cat tracker(?: ([^ ]+))? is connected)$/,
		),
		run: async ([deviceId1, deviceId2], __, runner) => {
			const catId = deviceId1 || deviceId2 || runner.store['cat:id']
			await runner.progress('IoT', catId)
			if (!runner.store[`cat:connection:${catId}`]) {
				const deviceFiles = deviceFileLocations({
					certsDir: path.resolve(process.cwd(), 'certificates'),
					deviceId: catId,
				})
				await runner.progress('IoT', `Connecting ${catId} to ${mqttEndpoint}`)
				const connection = new thingShadow({
					privateKey: deviceFiles.key,
					clientCert: deviceFiles.certWithCA,
					caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
					clientId: catId,
					host: mqttEndpoint,
					region: mqttEndpoint.split('.')[2],
				})
				// eslint-disable-next-line require-atomic-updates
				runner.store[`cat:connection:${catId}`] = connection

				await new Promise(resolve => {
					connection.on('connect', async () => {
						resolve()
					})
				})
			}
			return [catId, mqttEndpoint]
		},
	},
	{
		willRun: regexMatcher(
			/^the cat tracker(?: ([^ ]+)) updates its reported state with$/,
		),
		run: async ([deviceId], step, runner) => {
			if (!step.interpolatedArgument) {
				throw new Error('Must provide argument!')
			}
			const reported = JSON.parse(step.interpolatedArgument)
			const catId = deviceId || runner.store['cat:id']
			const connection = runner.store[`cat:connection:${catId}`]
			await runner.progress('IoT > reported', JSON.stringify(reported))
			const updatePromise = await new Promise(resolve => {
				connection.on(
					'status',
					(
						_thingName: string,
						stat: string,
						_clientToken: string,
						stateObject: object,
					) => {
						if (stat === 'accepted') {
							resolve(stateObject)
						}
					},
				)
				connection.register(deviceId, {}, async () => {
					connection.update(deviceId, { state: { reported } })
				})
			})
			return await updatePromise
		},
	},
]
