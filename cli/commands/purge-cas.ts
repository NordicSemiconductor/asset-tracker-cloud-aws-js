import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import {
	DeleteCACertificateCommand,
	DescribeCACertificateCommand,
	IoTClient,
	UpdateCACertificateCommand,
} from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName.js'
import { getCurrentCA } from '../jitp/currentCA.js'
import { listRegisteredCAs } from '../jitp/listRegisteredCAs.js'
import type { CommandDefinition } from './CommandDefinition.js'

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

export const purgeCAsCommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'purge-cas',
	options: [
		{
			flags: '-i, --caId <caId>',
			description: 'CA ID, if left blank all CAs will be purged',
		},
		{
			flags: '-c, --current',
			description: 'Purge current CA',
		},
	],
	action: async ({ caId, current }: { caId?: string; current?: boolean }) => {
		const iot = new IoTClient({})
		const { thingGroupName } = {
			...(await stackOutput(new CloudFormationClient({}))(CORE_STACK_NAME)),
		} as { [key: string]: string }

		const purge = purgeCACertificate({
			iot,
			thingGroupName: thingGroupName as string,
		})

		if (caId !== undefined) return purge(caId)
		if (current === true) return purge(getCurrentCA({ certsDir }))

		for (const id of Object.values(listRegisteredCAs({ iot }))) {
			await purge(id)
		}
	},
	help: 'Purges all nRF Asset Tracker CAs',
})
