import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { Iot, CloudFormation } from 'aws-sdk'
import { paginate } from '../../util/paginate'
import { region } from '../../cdk/regions'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackId'

export const purgeIotUserPolicyPrincipals = (): CommandDefinition => ({
	command: 'purge-iot-user-policy-principals',
	action: async () => {
		const { userIotPolicyArn } = {
			...(await stackOutput(new CloudFormation({ region }))(CORE_STACK_NAME)),
		} as { [key: string]: string }
		const policyName = userIotPolicyArn?.split('/').pop() as string
		const iot = new Iot({ region })
		await paginate({
			paginator: async (marker?: any) => {
				const { principals, nextMarker } = await iot
					.listPolicyPrincipals({
						policyName,
						marker,
					})
					.promise()
				await Promise.all(
					principals?.map(async (principal) => {
						console.log(
							`Detaching principal ${principal} from policy ${policyName} ...`,
						)
						return iot
							.detachPrincipalPolicy({
								policyName,
								principal,
							})
							.promise()
					}) ?? [],
				)
				return nextMarker
			},
		})
	},
	help: 'Purges all principals from the user IoT policy',
})
