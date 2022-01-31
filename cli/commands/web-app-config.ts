import { IoTClient } from '@aws-sdk/client-iot'
import { SSMClient } from '@aws-sdk/client-ssm'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { getIotEndpoint } from '../../cdk/helper/getIotEndpoint'
import { WEBAPP_STACK_NAME } from '../../cdk/stacks/stackName'
import { getSettings } from '../../util/settings'
import { CommandDefinition } from './CommandDefinition'

export const webAppConfigCommand = (): CommandDefinition => ({
	command: 'web-app-config',
	options: [
		{
			flags: '-p, --prefix <prefix>',
			description: `Prefix printed environment variables with this string. Defaults to "export PUBLIC_".`,
		},
		{
			flags: '-Q, --no-quote',
			description: `Whether to quote values.`,
		},
	],
	action: async ({ prefix, quote }: { prefix?: string; quote: boolean }) => {
		process.stdout.write(
			objectToEnv(
				{
					...(await getSettings<Record<string, string>>({
						ssm: new SSMClient({}),
						system: 'stack',
						scope: 'config',
						stackName: WEBAPP_STACK_NAME,
					})()),
					region: process.env.AWS_REGION,
					mqttEndpoint: await getIotEndpoint(new IoTClient({})),
				},
				{
					prefix: prefix ?? 'export PUBLIC_',
					quote: quote ? '"' : '',
				},
			),
		)
	},
	help: 'Prints the stack outputs as environment variables.',
})
