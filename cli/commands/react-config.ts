import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { objectToEnv } from '@bifravst/object-to-env'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { CORE_STACK_NAME, WEBAPP_STACK_NAME } from '../../cdk/stacks/stackName'

export const reactConfigCommand = (): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormationClient({}))
		process.stdout.write(
			objectToEnv(
				{
					...(await so(CORE_STACK_NAME)),
					...(await so(WEBAPP_STACK_NAME)),
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
