import { SSMClient } from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { getSettings } from '../../util/settings'
import { setting } from '../../cdk/helper/note'

export const showAPIConfigurationCommand = (): CommandDefinition => ({
	command: 'show-api-configuration <scope> <api>',
	action: async (scope: any, api: any) => {
		const ssm = new SSMClient({})

		const cfg = await getSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope,
			system: api,
		})()

		console.log()
		Object.entries(cfg).forEach(([k, v]) => setting(k, v))
	},
	help: 'Show the API configuration',
})
