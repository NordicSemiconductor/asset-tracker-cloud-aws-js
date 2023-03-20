import { promises as fs } from 'fs'
import os from 'os'
import { run } from '../process/run.js'
import { caFileLocations } from './caFileLocations.js'
import { deviceFileLocations } from './deviceFileLocations.js'

export const defaultDeviceCertificateValidityInDays = 10950

/**
 * Creates a certificate for a device, signed with the CA
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 *
 * The device's CSR must already exist.
 */
export const createDeviceCertificate = async ({
	certsDir,
	caId,
	log,
	debug,
	deviceId,
	daysValid,
}: {
	certsDir: string
	caId: string
	deviceId: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
	daysValid?: number
}): Promise<{ deviceId: string }> => {
	try {
		await fs.stat(certsDir)
	} catch {
		throw new Error(`${certsDir} does not exist.`)
	}

	log?.(`Generating certificate for device ${deviceId}`)
	const caFiles = caFileLocations({ certsDir, id: caId })
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

	await run({
		command: 'openssl',
		args: [
			'x509',
			'-req',
			'-in',
			deviceFiles.csr,
			'-CAkey',
			caFiles.key,
			'-CA',
			caFiles.cert,
			'-CAcreateserial',
			'-out',
			deviceFiles.cert,
			'-days',
			`${daysValid ?? defaultDeviceCertificateValidityInDays}`,
			'-sha256',
		],
		log: debug,
	})

	const certWithCa = (
		await Promise.all([
			fs.readFile(deviceFiles.cert),
			fs.readFile(caFiles.cert),
		])
	).join(os.EOL)

	await fs.writeFile(deviceFiles.certWithCA, certWithCa, 'utf-8')

	return { deviceId }
}
