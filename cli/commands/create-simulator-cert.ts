import * as chalk from 'chalk'
import { CommandDefinition } from './CommandDefinition'
import { randomWords } from '@nordicsemiconductor/random-words'
import * as path from 'path'
import {
	createDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../jitp/createDeviceCertificate'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'
import { createSimulatorKeyAndCSR } from '../jitp/createSimulatorKeyAndCSR'

export const createSimulatorCertCommand = ({
	endpoint,
	certsDir,
}: {
	endpoint: string
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
	],
	action: async ({
		deviceId,
		expires,
	}: {
		deviceId?: string
		expires?: string
	}) => {
		const id = deviceId ?? (await randomWords({ numWords: 3 })).join('-')

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
			deviceFiles.json,
			JSON.stringify(
				{
					caCert: awsIotRootCA,
					clientCert: await fs.readFile(deviceFiles.certWithCA, 'utf-8'),
					privateKey: await fs.readFile(deviceFiles.key, 'utf-8'),
					clientId: deviceId,
					brokerHostname: endpoint,
				},
				null,
				2,
			),
			'utf-8',
		)

		console.log(
			chalk.green(`Certificate for simulator ${chalk.yellow(id)} generated.`),
		)

		const certJSON = deviceFileLocations({ certsDir, deviceId: id }).json

		console.log()
		console.log(
			chalk.green('You can now connect to the broker:'),
			chalk.greenBright(
				'npm exec -- @nordicsemiconductor/asset-tracker-cloud-device-simulator-aws',
			),
			chalk.blueBright(certJSON),
		)

		console.log()
		console.log(
			chalk.green('You can now flash the credentials to your device'),
			chalk.greenBright(`node cli flash`),
			chalk.blueBright(id),
		)

		console.log()
		console.log(
			chalk.gray('Alternatively, use the file'),
			chalk.yellow(certJSON),
		)
		console.log(
			chalk.gray('with the'),
			chalk.blue.italic('Certificate Manager'),
			chalk.gray('in the'),
			chalk.blue('nRF Connect for Desktop'),
			chalk.gray('app'),
			chalk.blue.italic('LTE Link Monitor'),
		)
		console.log(chalk.gray('to flash the certificate onto the device.'))
		console.log(
			chalk.gray(
				'https://www.nordicsemi.com/Software-and-Tools/Development-Tools/nRF-Connect-for-desktop',
			),
		)
	},
	help: 'Generate a certificate for a device, signed with the CA.',
})
