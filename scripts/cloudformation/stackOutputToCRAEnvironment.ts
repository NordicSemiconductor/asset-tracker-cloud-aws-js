import { objectToEnv } from './objectToEnv'
import { stackOutput } from './stackOutput'

/**
 * Prints the stack outputs as create-react-app environment variables
 */
export const stackOutputToCRAEnvironment = async (args: {
	stackId: string
	region?: string
}) =>
	objectToEnv({
		...(await stackOutput(args)),
		region: args.region,
	})
