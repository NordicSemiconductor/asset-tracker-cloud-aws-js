import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import {
	WEBAPP_CI_STACK_NAME,
	WEBAPP_STACK_NAME,
} from '../../cdk/stacks/stackName'
import { StackOutputs as WebAppCIStackOutputs } from '../../cdk/stacks/WebAppCI'
import { fromEnv } from '../../util/fromEnv'
import { CommandDefinition } from './CommandDefinition'

const { region } = fromEnv({ region: 'AWS_REGION' })(process.env)

export const webappCICommand = (): CommandDefinition => ({
	command: 'web-app-ci',
	help: 'Print web app CI credentials',
	options: [
		{
			flags: '-s, --show-secret',
			description: 'Show the secret access key for the CI runner',
		},
	],
	action: async ({ showSecret }) => {
		const cf = new CloudFormationClient({})
		const webappCIStackConfig = await stackOutput(cf)<WebAppCIStackOutputs>(
			WEBAPP_CI_STACK_NAME,
		)
		console.log()
		console.log(
			chalk.grey('  Stack name:        '),
			chalk.yellow(WEBAPP_STACK_NAME),
		)
		console.log(chalk.grey('  Region:            '), chalk.yellow(region))
		console.log(
			chalk.grey('  Access Key ID:     '),
			chalk.yellow(webappCIStackConfig.userAccessKeyId),
		)
		console.log(
			chalk.grey('  Secret Access Key: '),
			chalk.yellow(
				showSecret === true
					? webappCIStackConfig.userSecretAccessKey
					: webappCIStackConfig.userSecretAccessKey.slice(0, 5) + '***',
			),
		)
	},
})
