import { SSMClient } from '@aws-sdk/client-ssm'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import {
	CORE_STACK_NAME,
	WEBAPP_STACK_NAME,
} from '../../cdk/stacks/stackName.js'
import { getSettings } from '../../util/settings.js'
import type { CommandDefinition } from './CommandDefinition.js'

const ssm = new SSMClient({})

export const webAppConfigCommand = ({
	mqttEndpoint,
}: {
	mqttEndpoint: string
}): CommandDefinition => ({
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
						ssm,
						system: 'stack',
						scope: 'config',
						stackName: WEBAPP_STACK_NAME,
					})()),
					...(await getSettings<Record<string, string>>({
						ssm,
						system: 'sentry',
						scope: 'thirdParty',
						stackName: CORE_STACK_NAME,
					})()),
					region: process.env.AWS_REGION,
					mqttEndpoint,
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
