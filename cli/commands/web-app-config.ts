import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { webAppConfig } from '../../cdk/webAppConfig'
import { CommandDefinition } from './CommandDefinition'

export const webAppConfigCommand = (): CommandDefinition => ({
	command: 'web-app-config',
	options: [
		{
			flags: '-p, --prefix <prefix>',
			description: `Prefix printed environment variables with this string. Defaults to "export PUBLIC_".`,
		},
	],
	action: async ({ prefix }) => {
		process.stdout.write(
			objectToEnv(
				await webAppConfig({
					cf: new CloudFormationClient({}),
					iot: new IoTClient({}),
				}),
				prefix ?? 'export PUBLIC_',
			),
		)
	},
	help: 'Prints the stack outputs as environment variables.',
})
