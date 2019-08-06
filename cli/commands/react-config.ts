import { ComandDefinition } from './CommandDefinition'
import { stackOutputToCRAEnvironment } from '../cloudformation/stackOutputToCRAEnvironment'

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
			}),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
