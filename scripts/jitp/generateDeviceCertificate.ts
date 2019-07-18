import * as os from 'os'
import { promises as fs } from 'fs'
import * as uuid from 'uuid'
import { caFileLocations } from './caFileLocations'
import { deviceFileLocations } from './deviceFileLocations'
import { run } from '../process/run'

/**
 * Generates a certificate for a device, signed with the CA
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const generateDeviceCertificate = async (args: {
	certsDir: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
}): Promise<{ deviceId: string }> => {
	const { certsDir, log, debug } = args

	try {
		await fs.stat(certsDir)
	} catch {
		throw new Error(`${certsDir} does not exist.`)
	}

	const deviceId = uuid.v4()
	log(`Generating certificate for device ${deviceId}`)
	const caFiles = caFileLocations(certsDir)
	const deviceFiles = deviceFileLocations(certsDir, deviceId)

	await run({
		command: 'openssl',
		args: ['genrsa', '-out', deviceFiles.key, '2048'],
		log: debug,
	})

	await run({
		command: 'openssl',
		args: [
			'req',
			'-new',
			'-key',
			deviceFiles.key,
			'-out',
			deviceFiles.csr,
			'-subj',
			`/CN=${deviceId}`,
		],
		log: debug,
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
			'10950',
			'-sha256',
		],
		log: debug,
	})

	await fs.writeFile(
		deviceFiles.certWithCA,
		(await Promise.all([
			fs.readFile(deviceFiles.cert),
			fs.readFile(caFiles.cert),
		])).join(os.EOL),
		'utf-8',
	)

	return { deviceId }
}
