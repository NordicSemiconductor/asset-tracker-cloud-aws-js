import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import {
	DetachPolicyCommand,
	IoTClient,
	ListTargetsForPolicyCommand,
} from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName.js'
import { paginate } from '../../util/paginate.js'
import type { CommandDefinition } from './CommandDefinition.js'

export const purgeIotUserPolicyPrincipals = (): CommandDefinition => ({
	command: 'purge-iot-user-policy-principals',
	action: async () => {
		const { userIotPolicyName } = {
			...(await stackOutput(new CloudFormationClient({}))(CORE_STACK_NAME)),
		} as { [key: string]: string }
		const iot = new IoTClient({})
		await paginate({
			paginator: async (marker?: any) => {
				const { targets, nextMarker } = await iot.send(
					new ListTargetsForPolicyCommand({
						policyName: userIotPolicyName,
						marker,
					}),
				)

				await Promise.all(
					targets?.map(async (target) => {
						console.log(
							`Detaching principal ${target} from policy ${userIotPolicyName} ...`,
						)
						return iot.send(
							new DetachPolicyCommand({
								policyName: userIotPolicyName,
								target,
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
