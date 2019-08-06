import { ComandDefinition } from './CommandDefinition'
import { stackOutputToCRAEnvironment } from '../cloudformation/stackOutputToCRAEnvironment'
import {
	DataBaseName,
	TableName,
	WorkGroupName,
} from '../../historicalData/settings'

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
			await stackOutputToCRAEnvironment({
				stackId,
				region,
				defaults: {
					region,
					historicaldataWorkgroupName: WorkGroupName,
					historicaldataDatabaseName: DataBaseName,
					historicaldataTableName: TableName,
				},
			}),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
