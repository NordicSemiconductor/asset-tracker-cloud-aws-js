import * as chalk from 'chalk'
import { CommandDefinition } from './CommandDefinition'
import { randomWords } from '@bifravst/random-words'
import * as path from 'path'
import { createDeviceCertificate } from '../jitp/createDeviceCertificate'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'

export const createDeviceCertCommand = ({
	endpoint,
	certsDir,
}: {
	endpoint: string
	certsDir: string
}): CommandDefinition => ({
	command: 'create-device-cert',
	options: [
		{
			flags: '-d, --deviceId <deviceId>',
			description: 'Device ID, if left blank a random ID will be generated',
		},
	],
	action: async ({ deviceId }: { deviceId: string }) => {
		const id = deviceId || (await randomWords({ numWords: 3 })).join('-')
		await createDeviceCertificate({
			deviceId: id,
			certsDir,
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
		})
		console.log(
			chalk.green(`Certificate for device ${chalk.yellow(id)} generated.`),
		)

		const certificate = deviceFileLocations({
			certsDir,
			deviceId: id,
		})

		// Writes the JSON file which works with the Certificate Manager of the LTA Link Monitor
		await fs.writeFile(
			certificate.json,
			JSON.stringify(
				{
					caCert: await fs.readFile(
						path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
						'utf-8',
					),
					clientCert: await fs.readFile(certificate.certWithCA, 'utf-8'),
					privateKey: await fs.readFile(certificate.key, 'utf-8'),
					clientId: id,
					brokerHostname: endpoint,
				},
				null,
				2,
			),
			'utf-8',
		)

		console.log()
		console.log(
			chalk.green('You can now connect to the broker:'),
			chalk.greenBright('node cli connect'),
			chalk.blueBright(id),
		)
		console.log()
		console.log(
			chalk.gray('Use the file'),
			chalk.yellow(deviceFileLocations({ certsDir, deviceId: id }).json),
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
