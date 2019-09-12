import { regexMatcher, StepRunner } from '@coderbyheart/bdd-feature-runner-aws'
import { BifravstWorld } from '../run-features'
import { randomWords } from '@bifravst/random-words'
import { generateDeviceCertificate } from '../../cli/jitp/generateDeviceCertificate'
import * as path from 'path'
import { device } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../../cli/jitp/deviceFileLocations'

export const bifravstStepRunners = ({
	mqttEndpoint,
}: {
	mqttEndpoint: string
}): StepRunner<BifravstWorld>[] => [
	{
		willRun: regexMatcher(/^(a cat exists|I generate a certificate)$/),
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
		willRun: regexMatcher(/^I connect the cat tracker$/),
		run: async (_, __, runner) => {
			const catId = runner.store['cat:id']
			if (!runner.store[`cat:connection:${catId}`]) {
				const deviceFiles = deviceFileLocations({
					certsDir: path.resolve(process.cwd(), 'certificates'),
					deviceId: catId,
				})
				await runner.progress('IoT', `Connecting ${catId} to ${mqttEndpoint}`)
				const connection = new device({
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
]
