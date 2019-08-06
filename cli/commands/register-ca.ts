import chalk from 'chalk'
import { ComandDefinition } from './CommandDefinition'
import { registerCA } from '../jitp/registerCA'

export const registerCaCommand = ({
	stackId,
	region,
	certsDir,
}: {
	stackId: string
	region: string
	certsDir: string
}): ComandDefinition => ({
	command: 'register-ca',
	action: async () => {
		const { certificateId } = await registerCA({
			stackId,
			certsDir,
			region,
			log: (...message: any[]) => {
				console.log(...message.map(m => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map(m => chalk.cyan(m)))
			},
		})
		console.log(
			chalk.green(`CA certificate ${chalk.yellow(certificateId)} registered.`),
		)
		console.log(chalk.green('You can now generate device certificates.'))
	},
	help: 'Registers a CA for Just-in-time provisioning.',
})
