import { randomWords } from '@nordicsemiconductor/random-words'
import chalk from 'chalk'
import { promises as fs } from 'fs'
import path from 'path'
import {
	createDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../jitp/createDeviceCertificate.js'
import { createSimulatorKeyAndCSR } from '../jitp/createSimulatorKeyAndCSR.js'
import { getCurrentCA } from '../jitp/currentCA.js'
import { deviceFileLocations } from '../jitp/deviceFileLocations.js'
import type { CommandDefinition } from './CommandDefinition.js'

export const defaultSecTag = 42

export const createSimulatorCertCommand = ({
	mqttEndpoint,
	certsDir,
}: {
	mqttEndpoint: string
	certsDir: string
}): CommandDefinition => ({
	command: 'create-simulator-cert',
	options: [
		{
			flags: '-d, --deviceId <deviceId>',
			description: 'Device ID, if left blank a random ID will be generated',
		},
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultDeviceCertificateValidityInDays} days.`,
		},
		{
			flags: '-c, --ca <caId>',
			description: `ID of the CA certificate to use. Defaults to the last created one.`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Use this secTag, defaults to ${defaultSecTag}`,
		},
		{
			flags: '-m, --mqtt-endpoint <mqttEndpoint>',
			description: `Use this MQTT endpoint, defaults to ${mqttEndpoint}`,
		},
	],
	action: async ({
		deviceId,
		expires,
		caId,
		secTag,
		mqttEndpoint: customEndpoint,
	}: {
		deviceId?: string
		expires?: string
		caId?: string
		secTag?: string
		mqttEndpoint?: string
	}) => {
		const id = deviceId ?? randomWords({ numWords: 3 }).join('-')
		const effectiveSecTag = secTag ?? defaultSecTag
		const effectiveMqttEndpoint = customEndpoint ?? mqttEndpoint

		await createSimulatorKeyAndCSR({
			deviceId: id,
			certsDir,
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
		})

		const awsIotRootCA = await fs.readFile(
			path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
			'utf-8',
		)

		await createDeviceCertificate({
			deviceId: id,
			certsDir,
			caId: caId ?? getCurrentCA({ certsDir }),
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})

		// Writes the JSON file which works with the Certificate Manager of the LTA Link Monitor
		const deviceFiles = deviceFileLocations({ certsDir, deviceId: id })
		await fs.writeFile(
			deviceFiles.simulatorJSON,
			JSON.stringify(
				{
					caCert: awsIotRootCA,
					clientCert: await fs.readFile(deviceFiles.certWithCA, 'utf-8'),
					privateKey: await fs.readFile(deviceFiles.key, 'utf-8'),
					clientId: id,
					brokerHostname: effectiveMqttEndpoint,
					secTag: effectiveSecTag,
				},
				null,
				2,
			),
			'utf-8',
		)

		console.log(
			chalk.green(`Certificate for simulator ${chalk.yellow(id)} generated.`),
		)

		const certJSON = deviceFileLocations({
			certsDir,
			deviceId: id,
		}).simulatorJSON

		console.log()
		console.log(
			chalk.green('You can now connect to the broker:'),
			chalk.greenBright(
				'npm exec -- @nordicsemiconductor/asset-tracker-cloud-device-simulator-aws',
			),
			chalk.blueBright(certJSON),
		)
	},
	help: 'Generate a certificate for a device, signed with the CA.',
})
