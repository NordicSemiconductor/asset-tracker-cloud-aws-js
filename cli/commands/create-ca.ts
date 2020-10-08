import * as chalk from 'chalk'
import { CommandDefinition } from './CommandDefinition'
import { createCA } from '../jitp/createCA'
import { Iot, CloudFormation } from 'aws-sdk'
import { region } from '../../cdk/regions'

export const createCACommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'create-ca',
	action: async () => {
		const iot = new Iot({ region })
		const cf = new CloudFormation({ region })

		const { certificateId } = await createCA({
			certsDir,
			iot,
			cf,
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
		})
		console.log(
			chalk.green(`CA certificate ${chalk.yellow(certificateId)} registered.`),
		)
		console.log(
			chalk.green('You can now generate device certificates.'),
			chalk.greenBright('node cli create-device-cert'),
		)
	},
	help:
		'Creates a CA certificate and registers it for Just-in-time provisioning.',
})
