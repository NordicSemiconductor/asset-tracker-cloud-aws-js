import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { objectToEnv } from '@nordicsemiconductor/object-to-env'
import { getIotEndpoint } from '../../cdk/helper/getIotEndpoint.js'
import {
	CORE_STACK_NAME,
	WEBAPP_STACK_NAME,
} from '../../cdk/stacks/stackName.js'
import { CommandDefinition } from './CommandDefinition.js'

export const reactConfigCommand = (): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormationClient({}))
		process.stdout.write(
			objectToEnv(
				{
					...(await so(CORE_STACK_NAME)),
					...(await so(WEBAPP_STACK_NAME)),
					mqttEndpoint: await getIotEndpoint(new IoTClient({})),
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
