import * as path from 'path'
import chalk from 'chalk'
import { generateDeviceCertificate } from './jitp/generateDeviceCertificate'

/**
 * Generate a certificate for a device, signed with the CA
 */
generateDeviceCertificate({
	certsDir: path.resolve(process.cwd(), 'certificates'),
	log: (...message: any[]) => {
		console.log(...message.map(m => chalk.magenta(m)))
	},
	debug: (...message: any[]) => {
		console.log(...message.map(m => chalk.cyan(m)))
	},
})
	.then(({ deviceId }) => {
		console.log(
			chalk.green(
				`Certificate for device ${chalk.yellow(deviceId)} generated.`,
			),
		)
		console.log(chalk.green('You can now connect to the broker.'))
	})
	.catch(error => {
		console.error(chalk.red(error))
		process.exit(1)
	})
