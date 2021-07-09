import { SSMClient } from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { putSettings } from '../../util/settings'

export const configureCommand = (): CommandDefinition => ({
	command: 'configure <scope> <system> <property> <value>',
	options: [
		{
			flags: '-d, --deleteBeforeUpdate',
			description: `Useful when depending on the parameter having version 1, e.g. for use in CloudFormation`,
		},
	],
	action: async (
		scope: any,
		system: any,
		property: string,
		value: string,
		{ deleteBeforeUpdate },
	) => {
		const ssm = new SSMClient({})

		const { name } = await putSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope,
			system,
		})({
			property,
			value,
			deleteBeforeUpdate,
		})

		console.log()
		console.log(
			chalk.green('Updated the configuration'),
			chalk.blueBright(name),
			chalk.green('to'),
			chalk.yellow(value),
		)
	},
	help: 'Configure the system',
})
