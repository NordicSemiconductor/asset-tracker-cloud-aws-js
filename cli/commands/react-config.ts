import { CommandDefinition } from './CommandDefinition'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { stackOutput, objectToEnv } from '@bifravst/cloudformation-helpers'
import { stackId as webStackId } from '../../cdk/stacks/WebApps'
import { CloudFormation } from 'aws-sdk'

export const reactConfigCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormation({ region }))
		process.stdout.write(
			objectToEnv({
				region,
				historicaldataWorkgroupName: WorkGroupName({
					bifravstStackName: stackId,
				}),
				historicaldataDatabaseName: DataBaseName({
					bifravstStackName: stackId,
				}),
				historicaldataTableName: UpdatesTableName({
					bifravstStackName: stackId,
				}),
				...(await so(stackId)),
				...(await so(
					webStackId({
						bifravstStackName: stackId,
					}),
				)),
			}),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
