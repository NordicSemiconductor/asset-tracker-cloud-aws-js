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
}).catch(error => {
	console.error(error)
	process.exit(1)
})
