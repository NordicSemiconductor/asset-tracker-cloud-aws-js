import { SSMClient } from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition.js'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName.js'
import { putSettings } from '../../util/settings.js'

export const configureAPICommand = (): CommandDefinition => ({
	command: 'configure-api <scope> <api> <property> <value>',
	options: [
		{
			flags: '-d, --deleteBeforeUpdate',
			description: `Useful when depending on the parameter having version 1, e.g. for use in CloudFormation`,
		},
	],
	action: async (
		scope: any,
		api: any,
		property: string,
		value: string,
		{ deleteBeforeUpdate },
	) => {
		const ssm = new SSMClient({})

		const { name } = await putSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope,
			system: api,
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
	help: 'Configure an API',
})
