import { SSMClient } from '@aws-sdk/client-ssm'
import { setting } from '../../cdk/helper/note.js'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName.js'
import { getSettings } from '../../util/settings.js'
import type { CommandDefinition } from './CommandDefinition.js'

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
