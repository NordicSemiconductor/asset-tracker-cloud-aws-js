import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { createCA, defaultCAValidityInDays } from '../jitp/createCA'
import { setCurrentCA } from '../jitp/currentCA'
import { CommandDefinition } from './CommandDefinition'

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
		{
			flags: '-t, --tags <tags>',
			description: `Comma-separated list of tags to assign to the CA certificate (tag1=value1,tag2=value2,tag3).`,
		},
	],
	action: async ({ expires, tags }: { expires?: string; tags?: string }) => {
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
			tags: (tags ?? '')
				.split(',')
				.map((tagDefinition) => tagDefinition.split('=', 2))
				.map(([Key, Value]) => ({ Key, Value: Value ?? '' }))
				.filter(({ Key }) => Key !== ''),
		})
		console.log(
			chalk.green(`CA certificate ${chalk.yellow(certificateId)} registered.`),
		)
		console.log(
			chalk.green('You can now generate device certificates.'),
			chalk.greenBright('./cli.sh create-and-provision-device-cert'),
		)
		setCurrentCA({ certsDir, caId: certificateId })
	},
	help: 'Creates a CA certificate and registers it for Just-in-time provisioning.',
})
