import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import {
	DeleteCACertificateCommand,
	DescribeCACertificateCommand,
	IoTClient,
	ListCACertificatesCommand,
	UpdateCACertificateCommand,
} from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import * as chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { paginate } from '../../util/paginate'
import { CommandDefinition } from './CommandDefinition'

const purgeCACertificate =
	({ iot, thingGroupName }: { iot: IoTClient; thingGroupName: string }) =>
	async (certificateId: string) => {
		const cert = await iot.send(
			new DescribeCACertificateCommand({
				certificateId,
			}),
		)

		const config = JSON.parse(cert.registrationConfig?.templateBody ?? '{}')
		if (
			(
				(config?.Resources?.thing?.Properties?.ThingGroups as string[]) ?? []
			).includes(thingGroupName)
		) {
			console.log(`Marking CA certificate ${certificateId} as INACTIVE ...`)
			await iot.send(
				new UpdateCACertificateCommand({
					certificateId,
					newStatus: 'INACTIVE',
				}),
			)

			console.log(`Deleting CA certificate ${certificateId}...`)
			await iot.send(
				new DeleteCACertificateCommand({
					certificateId,
				}),
			)
		} else {
			console.error(
				chalk.yellow.dim(`Not a nRF Asset Tracker CA: ${certificateId}`),
			)
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
		const iot = new IoTClient({})
		const { thingGroupName } = {
			...(await stackOutput(new CloudFormationClient({}))(CORE_STACK_NAME)),
		} as { [key: string]: string }

		const purge = purgeCACertificate({ iot, thingGroupName })

		if (caId) return purge(caId)

		return paginate({
			paginator: async (marker?: any) =>
				iot
					.send(
						new ListCACertificatesCommand({
							marker,
						}),
					)

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
	help: 'Purges all nRF Asset Tracker CAs',
})