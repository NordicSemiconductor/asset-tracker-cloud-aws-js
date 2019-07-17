import * as path from 'path'
import { registerCA } from './jitp/registerCA'
import chalk from 'chalk'

/**
 * Registers a CA for Just-in-time provisioning
 */
registerCA({
	stackId: process.env.STACK_ID || 'bifravst',
	certsDir: path.resolve(process.cwd(), 'certificates'),
	region: process.env.AWS_DEFAULT_REGION,
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
