import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { StackOutputs as FirmwareCIStackOutputs } from '../../cdk/stacks/FirmwareCI'
import { FIRMWARE_CI_STACK_NAME } from '../../cdk/stacks/stackName'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'

export const firmwareCICommand = ({
	endpoint,
}: {
	endpoint: string
}): CommandDefinition => ({
	command: 'firmware-ci',
	help: 'Print firmware CI credentials',
	options: [
		{
			flags: '-s, --show-secret',
			description: 'Show the secret access key for the CI runner',
		},
	],
	action: async ({ showSecret }) => {
		const cf = new CloudFormationClient({})
		const firmwareCIStackConfig = await stackOutput(cf)<FirmwareCIStackOutputs>(
			FIRMWARE_CI_STACK_NAME,
		)
		console.log()
		console.log(
			chalk.grey('  Region:            '),
			chalk.yellow(endpoint.split('.')[2]),
		)
		console.log(
			chalk.grey('  Bucket name:       '),
			chalk.yellow(firmwareCIStackConfig.bucketName),
		)
		console.log(
			chalk.grey('  Access Key ID:     '),
			chalk.yellow(firmwareCIStackConfig.userAccessKeyId),
		)
		console.log(
			chalk.grey('  Secret Access Key: '),
			chalk.yellow(
				showSecret === true
					? firmwareCIStackConfig.userSecretAccessKey
					: firmwareCIStackConfig.userSecretAccessKey.substr(0, 5) + '***',
			),
		)
	},
})
