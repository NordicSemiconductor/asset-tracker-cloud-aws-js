import { CommandDefinition } from './CommandDefinition'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { stackOutput, objectToEnv } from '@bifravst/cloudformation-helpers'
import { CloudFormation } from 'aws-sdk'
import { CORE_STACK_NAME, WEBAPPS_STACK_NAME } from '../../cdk/stacks/stackId'
import { region } from '../../cdk/regions'

export const reactConfigCommand = (): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormation({ region }))
		process.stdout.write(
			objectToEnv(
				{
					historicaldataWorkgroupName: WorkGroupName(),
					historicaldataDatabaseName: DataBaseName(),
					historicaldataTableName: UpdatesTableName(),
					...(await so(CORE_STACK_NAME)),
					...(await so(WEBAPPS_STACK_NAME)),
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
