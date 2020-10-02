import { Iot } from 'aws-sdk'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'

export const deleteDevice = async ({
	iot,
	thingGroupName,
	thingName,
	certsDir,
}: {
	iot: Iot
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

	await iot
		.detachThingPrincipal({
			thingName,
			principal: certificateArn,
		})
		.promise()

	await iot
		.updateCertificate({
			certificateId,
			newStatus: 'INACTIVE',
		})
		.promise()

	await iot
		.deleteCertificate({
			certificateId,
		})
		.promise()

	await iot
		.removeThingFromThingGroup({
			thingName,
			thingGroupName,
		})
		.promise()

	await iot
		.deleteThing({
			thingName,
		})
		.promise()
}
