import {
	DeleteCertificateCommand,
	DeleteThingCommand,
	DetachThingPrincipalCommand,
	IoTClient,
	RemoveThingFromThingGroupCommand,
	UpdateCertificateCommand,
} from '@aws-sdk/client-iot'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'

export const deleteDevice = async ({
	iot,
	thingGroupName,
	thingName,
	certsDir,
}: {
	iot: IoTClient
	certsDir: string
	thingGroupName: string
	thingName: string
}): Promise<void> => {
	const { certificateArn, certificateId } = JSON.parse(
		await fs.readFile(
			deviceFileLocations({ certsDir, deviceId: thingName }).json,
			'utf-8',
		),
	)

	await iot.send(
		new DetachThingPrincipalCommand({
			thingName,
			principal: certificateArn,
		}),
	)

	await iot.send(
		new UpdateCertificateCommand({
			certificateId,
			newStatus: 'INACTIVE',
		}),
	)

	await iot.send(
		new DeleteCertificateCommand({
			certificateId,
		}),
	)

	await iot.send(
		new RemoveThingFromThingGroupCommand({
			thingName,
			thingGroupName,
		}),
	)

	await iot.send(
		new DeleteThingCommand({
			thingName,
		}),
	)
}
