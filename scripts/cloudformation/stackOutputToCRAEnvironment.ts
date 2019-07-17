import { CloudFormation } from 'aws-sdk'
import { objectToEnv } from './objectToEnv'
import { toObject } from './toObject'

/**
 * Prints the stack outputs as create-react-app environment variables
 */
export const stackOutputToCRAEnvironment = async (args: {
	stackId: string
	region?: string
}) => {
	const { region, stackId } = args
	const cf = new CloudFormation({ region })
	const { Stacks } = await cf.describeStacks({ StackName: stackId }).promise()
	if (!Stacks || !Stacks.length || !Stacks[0].Outputs) {
		throw new Error(`Stack ${stackId} not found.`)
	}
	return objectToEnv({
		...toObject(Stacks[0].Outputs),
		region,
	})
}
