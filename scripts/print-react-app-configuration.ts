import { stackOutputToCRAEnvironment } from './cloudformation/stackOutputToCRAEnvironment'
import chalk from 'chalk'

/**
 * Prints the stack outputs as create-react-app environment variables
 */
stackOutputToCRAEnvironment({
	stackId: process.env.STACK_ID || 'bifravst',
	region: process.env.AWS_DEFAULT_REGION,
})
	.then(env => {
		process.stdout.write(env)
	})
	.catch(error => {
		console.error(chalk.red(error))
		process.exit(1)
	})
