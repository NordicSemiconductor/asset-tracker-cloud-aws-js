import * as os from 'os'
import { promises as fs } from 'fs'
import { caFileLocations } from './caFileLocations'
import { deviceFileLocations } from './deviceFileLocations'
import { run } from '../process/run'

/**
 * Generates a certificate for a device, signed with the CA
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const generateDeviceCertificate = async ({
	endpoint,
	certsDir,
	log,
	debug,
	deviceId,
	caCert,
}: {
	endpoint: string
	certsDir: string
	deviceId: string
	caCert: string
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
}): Promise<{ deviceId: string }> => {
	try {
		await fs.stat(certsDir)
	} catch {
		throw new Error(`${certsDir} does not exist.`)
	}

	log(`Generating certificate for device ${deviceId}`)
	const caFiles = caFileLocations(certsDir)
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

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

	const certWithCa = (await Promise.all([
		fs.readFile(deviceFiles.cert),
		fs.readFile(caFiles.cert),
	])).join(os.EOL)

	await fs.writeFile(deviceFiles.certWithCA, certWithCa, 'utf-8')

	// Writes the JSON file which works with the Certificate Manager of the LTA Link Monitor
	await fs.writeFile(
		deviceFiles.json,
		JSON.stringify(
			{
				caCert: await fs.readFile(caCert, 'utf-8'),
				clientCert: certWithCa,
				privateKey: await fs.readFile(deviceFiles.key, 'utf-8'),
				clientId: deviceId,
				brokerHostname: endpoint,
			},
			null,
			2,
		),
		'utf-8',
	)

	return { deviceId }
}
