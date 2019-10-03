import chalk from 'chalk'
import { ComandDefinition } from './CommandDefinition'
import { randomWords } from '@nordicplayground/random-words'
import * as path from 'path'
import { generateDeviceCertificate } from '../jitp/generateDeviceCertificate'
import { deviceFileLocations } from '../jitp/deviceFileLocations'

export const generateCertCommand = ({
	endpoint,
}: {
	endpoint: string
}): ComandDefinition => ({
	command: 'generate-cert',
	options: [
		{
			flags: '-d, --deviceId <deviceId>',
			description: 'Device ID, if left blank a random ID will be generated',
		},
	],
	action: async ({ deviceId }: { deviceId: string }) => {
		const id = deviceId || (await randomWords({ numWords: 3 })).join('-')
		const certsDir = path.resolve(process.cwd(), 'certificates')
		await generateDeviceCertificate({
			endpoint,
			deviceId: id,
			certsDir,
			caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
			log: (...message: any[]) => {
				console.log(...message.map(m => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map(m => chalk.cyan(m)))
			},
		})
		console.log(
			chalk.green(`Certificate for device ${chalk.yellow(id)} generated.`),
		)
		console.log()
		console.log(chalk.green('You can now connect to the broker.'))
		console.log()
		console.log(
			chalk.gray('Use the file'),
			chalk.yellow(deviceFileLocations({ certsDir, deviceId }).json),
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
