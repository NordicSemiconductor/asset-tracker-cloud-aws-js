import { stackOutputToCRAEnvironment } from './cloudformation/stackOutputToCRAEnvironment'

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
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
