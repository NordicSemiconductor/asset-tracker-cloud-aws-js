import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import * as chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { setCurrentCA } from '../jitp/currentCA'
import { registerCA } from '../jitp/registerCA'
import { CommandDefinition } from './CommandDefinition'

export const registerCACommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'register-ca <caCertificate> <caKey>',
	options: [
		{
			flags: '-t, --tags <tags>',
			description: `Comma-separated list of tags to assign to the CA certificate (tag1=value1,tag2=value2,tag3).`,
		},
	],
	action: async (caCertificate, caKey, { tags }: { tags?: string }) => {
		const iot = new IoTClient({})
		const cf = new CloudFormationClient({})

		const { certificateId } = await registerCA({
			iot,
			cf,
			certsDir,
			caCertificateFile: caCertificate,
			caCertificateKeyFile: caKey,
			stack: CORE_STACK_NAME,
			tags: (tags ?? '')
				.split(',')
				.map((tagDefinition) => tagDefinition.split('=', 2))
				.map(([Key, Value]) => ({ Key, Value: Value ?? '' }))
				.filter(({ Key }) => Key !== ''),
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
			chalk.greenBright('./cli.sh create-and-provision-device-cert'),
		)
		setCurrentCA({ certsDir, caId: certificateId })
	},
	help: 'Registers an existing CA certificate for Just-in-time provisioning.',
})
