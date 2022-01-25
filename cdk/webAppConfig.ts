import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { getIotEndpoint } from './helper/getIotEndpoint'
import { CORE_STACK_NAME, WEBAPP_STACK_NAME } from './stacks/stackName'

/**
 * Returns the configuration used in the web application
 */
export const webAppConfig = async ({
	cf,
	iot,
}: {
	cf: CloudFormationClient
	iot: IoTClient
}): Promise<Record<string, string>> => {
	const so = stackOutput(cf)
	return {
		...(await so(CORE_STACK_NAME)),
		...(await so(WEBAPP_STACK_NAME)),
		mqttEndpoint: await getIotEndpoint(iot),
	}
}
