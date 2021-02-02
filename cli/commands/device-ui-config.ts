import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DEVICEUI_STACK_NAME } from '../../cdk/stacks/stackName'

export const deviceUIConfigCommand = (): CommandDefinition => ({
	command: 'device-ui-config',
	action: async () => {
		const so = stackOutput(new CloudFormationClient({}))
		process.stdout.write(
			objectToEnv(await so(DEVICEUI_STACK_NAME), 'SNOWPACK_PUBLIC_'),
		)
	},
	help:
		'Prints environment variables needed for the Device Simulator Web Application.',
})
