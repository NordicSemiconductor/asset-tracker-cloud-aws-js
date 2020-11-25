import * as os from 'os'
import { promises as fs } from 'fs'
import { caFileLocations } from './caFileLocations'
import { deviceFileLocations } from './deviceFileLocations'
import { run } from '../process/run'

/**
 * Creates a certificate for a device, signed with the CA
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const createDeviceCertificate = async ({
	certsDir,
	log,
	debug,
	deviceId,
	awsIotRootCA,
	mqttEndpoint,
}: {
	certsDir: string
	deviceId: string
	mqttEndpoint: string
	awsIotRootCA: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
}): Promise<{ deviceId: string }> => {
	try {
		await fs.stat(certsDir)
	} catch {
		throw new Error(`${certsDir} does not exist.`)
	}

	log?.(`Generating certificate for device ${deviceId}`)
	const caFiles = caFileLocations(certsDir)
	const deviceFiles = deviceFileLocations({
		certsDir,
		deviceId,
	})

	await run({
		command: 'openssl',
		args: [
			'ecparam',
			'-out',
			deviceFiles.key,
			'-name',
			'prime256v1',
			'-genkey',
		],
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

	const certWithCa = (
		await Promise.all([
			fs.readFile(deviceFiles.cert),
			fs.readFile(caFiles.cert),
		])
	).join(os.EOL)

	await fs.writeFile(deviceFiles.certWithCA, certWithCa, 'utf-8')

	// Writes the JSON file which works with the Certificate Manager of the LTA Link Monitor
	await fs.writeFile(
		deviceFiles.json,
		JSON.stringify(
			{
				caCert: awsIotRootCA,
				clientCert: certWithCa,
				privateKey: await fs.readFile(deviceFiles.key, 'utf-8'),
				clientId: deviceId,
				brokerHostname: mqttEndpoint,
			},
			null,
			2,
		),
		'utf-8',
	)

	return { deviceId }
}
