import { CommandDefinition } from './CommandDefinition'
import { Iot, CloudFormation } from 'aws-sdk'
import { paginate } from '../../util/paginate'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { region } from '../../cdk/regions'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackId'

const purgeCACertificate = ({
	iot,
	thingGroupName,
}: {
	iot: Iot
	thingGroupName: string
}) => async (certificateId: string) => {
	const cert = await iot
		.describeCACertificate({
			certificateId,
		})
		.promise()
	const config = JSON.parse(cert.registrationConfig?.templateBody ?? '{}')
	if (
		(
			(config?.Resources?.thing?.Properties?.ThingGroups as string[]) ?? []
		).includes(thingGroupName)
	) {
		console.log(`Marking CA certificate ${certificateId} as INACTIVE ...`)
		await iot
			.updateCACertificate({
				certificateId,
				newStatus: 'INACTIVE',
			})
			.promise()
		console.log(`Deleting CA certificate ${certificateId}...`)
		await iot
			.deleteCACertificate({
				certificateId,
			})
			.promise()
	} else {
		console.log(`Not a Bifravst CA: ${certificateId}`)
	}
}

export const purgeCAsCommand = (): CommandDefinition => ({
	command: 'purge-cas',
	options: [
		{
			flags: '-i, --caId <caId>',
			description: 'CA ID, if left blank all CAs will be purged',
		},
	],
	action: async ({ caId }: { caId: string }) => {
		const iot = new Iot({ region })
		const { thingGroupName } = {
			...(await stackOutput(new CloudFormation({ region }))(CORE_STACK_NAME)),
		} as { [key: string]: string }

		const purge = purgeCACertificate({ iot, thingGroupName })

		if (caId) return purge(caId)

		return paginate({
			paginator: async (marker?: any) =>
				iot
					.listCACertificates({
						marker,
					})
					.promise()
					.then(async ({ certificates, nextMarker }) => {
						await Promise.all(
							certificates?.map(async ({ certificateId }) =>
								purge(certificateId as string),
							) ?? [],
						)
						return nextMarker
					}),
		})
	},
	help: 'Purges all Bifravst CAs',
})
