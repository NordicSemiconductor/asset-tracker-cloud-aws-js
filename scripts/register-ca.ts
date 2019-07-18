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
})
	.then(({ certificateId }) => {
		console.log(
			chalk.green(`CA certificate ${chalk.yellow(certificateId)} registered.`),
		)
		console.log(chalk.green('You can now generate device certificates.'))
	})
	.catch(error => {
		console.error(chalk.red(error))
		process.exit(1)
	})
