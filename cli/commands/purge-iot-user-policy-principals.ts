import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import {
	DetachPrincipalPolicyCommand,
	IoTClient,
	ListPolicyPrincipalsCommand,
} from '@aws-sdk/client-iot'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { paginate } from '../../util/paginate'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'

export const purgeIotUserPolicyPrincipals = (): CommandDefinition => ({
	command: 'purge-iot-user-policy-principals',
	action: async () => {
		const { userIotPolicyArn } = {
			...(await stackOutput(new CloudFormationClient({}))(CORE_STACK_NAME)),
		} as { [key: string]: string }
		const policyName = userIotPolicyArn?.split('/').pop() as string
		const iot = new IoTClient({})
		await paginate({
			paginator: async (marker?: any) => {
				const { principals, nextMarker } = await iot.send(
					new ListPolicyPrincipalsCommand({
						policyName,
						marker,
					}),
				)

				await Promise.all(
					principals?.map(async (principal) => {
						console.log(
							`Detaching principal ${principal} from policy ${policyName} ...`,
						)
						return iot.send(
							new DetachPrincipalPolicyCommand({
								policyName,
								principal,
							}),
						)
					}) ?? [],
				)
				return nextMarker
			},
		})
	},
	help: 'Purges all principals from the user IoT policy',
})
