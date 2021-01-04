import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { objectToEnv } from '@bifravst/object-to-env'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DEVICEUI_STACK_NAME } from '../../cdk/stacks/stackName'
import { region } from '../../cdk/regions'

export const deviceUIConfigCommand = (): CommandDefinition => ({
	command: 'device-ui-config',
	action: async () => {
		const so = stackOutput(new CloudFormationClient({ region }))
		process.stdout.write(
			objectToEnv(
				{
					...(await so(DEVICEUI_STACK_NAME)),
					region,
				},
				'SNOWPACK_PUBLIC_',
			),
		)
	},
	help:
		'Prints environment variables needed for the Device Simulator Web Application.',
})
