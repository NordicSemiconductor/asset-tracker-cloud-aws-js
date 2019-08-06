import { objectToEnv } from './objectToEnv'
import { stackOutput } from './stackOutput'

/**
 * Prints the stack outputs as create-react-app environment variables
 */
export const stackOutputToCRAEnvironment = async ({
	stackId,
	region,
	defaults,
}: {
	stackId: string
	region: string
	defaults: {
		[key: string]: string
	}
}) =>
	objectToEnv({
		...defaults,
		...(await stackOutput({
			stackId,
			region,
		})),
	})
