import * as chalk from 'chalk'
import { CommandDefinition } from './CommandDefinition'
import { createCA, defaultCAValidityInDays } from '../jitp/createCA'
import { IoTClient } from '@aws-sdk/client-iot'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'

export const createCACommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'create-ca',
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultCAValidityInDays} days.`,
		},
	],
	action: async ({ expires }: { expires?: string }) => {
		const iot = new IoTClient({})
		const cf = new CloudFormationClient({})

		const { certificateId } = await createCA({
			certsDir,
			iot,
			cf,
			stack: CORE_STACK_NAME,
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		console.log(
			chalk.green(`CA certificate ${chalk.yellow(certificateId)} registered.`),
		)
		console.log(
			chalk.green('You can now generate device certificates.'),
			chalk.greenBright('node cli create-device-cert'),
		)
	},
	help: 'Creates a CA certificate and registers it for Just-in-time provisioning.',
})
