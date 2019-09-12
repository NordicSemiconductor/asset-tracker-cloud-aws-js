import { ComandDefinition } from './CommandDefinition'
import {
	DataBaseName,
	TableName,
	WorkGroupName,
} from '../../historicalData/settings'
import { objectToEnv } from '../cloudformation/objectToEnv'
import { stackOutput } from '../cloudformation/stackOutput'
import { stackId as webStackId } from '../../cdk/stacks/WebApps'

export const reactConfigCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): ComandDefinition => ({
	command: 'react-config',
	action: async () => {
		process.stdout.write(
			objectToEnv({
				region,
				historicaldataWorkgroupName: WorkGroupName({
					bifravstStackName: stackId,
				}),
				historicaldataDatabaseName: DataBaseName,
				historicaldataTableName: TableName,
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
