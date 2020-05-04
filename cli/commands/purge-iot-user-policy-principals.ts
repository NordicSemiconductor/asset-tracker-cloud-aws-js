import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { Iot } from 'aws-sdk'
import { paginate } from '../../util/paginate'

export const purgeIotUserPolicyPrincipals = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): CommandDefinition => ({
	command: 'purge-iot-user-policy-principals',
	action: async () => {
		const { userIotPolicyArn } = {
			...(await stackOutput({
				stackId,
				region,
			})),
		} as { [key: string]: string }
		const policyName = userIotPolicyArn?.split('/').pop() as string
		const iot = new Iot({ region })
		await paginate({
			paginator: async (marker?: any) =>
				iot
					.listPolicyPrincipals({
						policyName,
						marker,
					})
					.promise()
					.then(async ({ principals, nextMarker }) => {
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
					}),
		})
	},
	help: 'Purges all principals from the user IoT policy',
})
