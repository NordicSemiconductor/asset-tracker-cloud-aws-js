import { Iot } from 'aws-sdk'
import { v4 } from 'uuid'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'
import * as path from 'path'

export const createDevice = async ({
	iot,
	thingGroupName,
	certsDir,
	endpoint,
}: {
	iot: Iot
	certsDir: string
	thingGroupName: string
	endpoint: string
}): Promise<{ thingArn: string; thingName: string }> => {
	const thingName = `firmware-ci-${v4()}`

	const { thingArn } = await iot
		.createThing({
			thingName,
		})
		.promise()

	await iot
		.addThingToThingGroup({
			thingArn,
			thingGroupName,
		})
		.promise()

	const certs = await iot
		.createKeysAndCertificate({ setAsActive: true })
		.promise()
	if (certs.certificateArn === undefined)
		throw new Error(`Failed to create certificate.`)

	await iot
		.attachThingPrincipal({
			principal: certs.certificateArn,
			thingName,
		})
		.promise()

	const certificate = deviceFileLocations({ certsDir, deviceId: thingName })

	await fs.writeFile(
		certificate.key,
		certs.keyPair?.PrivateKey as string,
		'utf-8',
	)
	await fs.writeFile(
		certificate.certWithCA,
		certs.certificatePem as string,
		'utf-8',
	)

	// Writes the JSON file which works with the Certificate Manager of the LTA Link Monitor
	await fs.writeFile(
		certificate.json,
		JSON.stringify(
			{
				clientId: thingName,
				brokerHostname: endpoint,
				caCert: await fs.readFile(
					path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
					'utf-8',
				),
				clientCert: certs.certificatePem as string,
				privateKey: certs.keyPair?.PrivateKey as string,
				certificateArn: certs.certificateArn,
				certificateId: certs.certificateId,
			},
			null,
			2,
		),
		'utf-8',
	)

	return { thingName, thingArn: thingArn as string }
}
