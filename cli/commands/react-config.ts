import { CommandDefinition } from './CommandDefinition'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { stackOutput, objectToEnv } from '@bifravst/cloudformation-helpers'
import { stackId as webStackId } from '../../cdk/stacks/WebApps'

export const reactConfigCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
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
				...(await stackOutput({
					stackId,
					region,
				})),
				...(await stackOutput({
					stackId: webStackId({
						bifravstStackName: stackId,
					}),
					region,
				})),
			}),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
