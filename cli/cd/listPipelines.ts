import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import type { StackOutputs } from '../../cdk/stacks/ContinuousDeployment.js'
import {
	CONTINUOUS_DEPLOYMENT_STACK_NAME,
	CORE_STACK_NAME,
} from '../../cdk/stacks/stackName.js'

/**
 * Returns the active pipelines of the CD stack
 */
export const listPipelines = async (): Promise<string[]> => {
	const cf = new CloudFormationClient({})
	const config = await stackOutput(cf)<StackOutputs>(
		CONTINUOUS_DEPLOYMENT_STACK_NAME,
	)

	const pipelines = [`${CORE_STACK_NAME}-continuous-deployment`]
	if (config.webAppCD === 'enabled')
		pipelines.push(`${CORE_STACK_NAME}-continuous-deployment-webAppCD`)
	return pipelines
}
