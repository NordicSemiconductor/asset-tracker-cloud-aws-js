import chalk from 'chalk'
import { ComandDefinition } from './CommandDefinition'
import { randomWords } from '@bifravst/random-words'
import * as path from 'path'
import { generateDeviceCertificate } from '../jitp/generateDeviceCertificate'

export const generateCertCommand = (): ComandDefinition => ({
	command: 'generate-cert',
	options: [
		{
			flags: '-d, --deviceId <deviceId>',
			description: 'Device ID, if left blank a random ID will be generated',
		},
	],
	action: async ({ deviceId }: { deviceId: string }) => {
		const id = deviceId || (await randomWords({ numWords: 3 })).join('-')
		await generateDeviceCertificate({
			deviceId: id,
			certsDir: path.resolve(process.cwd(), 'certificates'),
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
		console.log(chalk.green('You can now connect to the broker.'))
	},
	help: 'Generate a certificate for a device, signed with the CA.',
})
