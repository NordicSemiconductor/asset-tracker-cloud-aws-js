import { SSMClient } from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { getApiSettings } from '../../util/apiConfiguration'

export const showAPIConfigurationCommand = (): CommandDefinition => ({
	command: 'show-api-configuraion <scope> <api>',
	action: async (scope: any, api: any) => {
		const ssm = new SSMClient({})

		const cfg = await getApiSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope,
			api,
		})()

		console.log()
		Object.entries(cfg).forEach(([k, v]) =>
			console.log(chalk.blueBright(k), chalk.yellow(v)),
		)
	},
	help: 'Show the API configuration',
})
