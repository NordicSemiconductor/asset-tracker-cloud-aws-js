import { CommandDefinition } from './CommandDefinition'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { stackOutput, objectToEnv } from '@bifravst/cloudformation-helpers'
import { CloudFormation } from 'aws-sdk'
import { stackId } from '../../cdk/stacks/stackId'

export const reactConfigCommand = ({
	region,
}: {
	region: string
}): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormation({ region }))
		process.stdout.write(
			objectToEnv(
				{
					region,
					historicaldataWorkgroupName: WorkGroupName(),
					historicaldataDatabaseName: DataBaseName(),
					historicaldataTableName: UpdatesTableName(),
					...(await so(stackId())),
					...(await so(stackId('webapps'))),
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
