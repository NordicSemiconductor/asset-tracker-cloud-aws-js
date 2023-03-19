import { promises as fs } from 'fs'
import { run } from '../process/run.js'
import { deviceFileLocations } from './deviceFileLocations.js'

/**
 * Creates a private key and a CSR for a simulated device
 */
export const createSimulatorKeyAndCSR = async ({
	certsDir,
	log,
	debug,
	deviceId,
}: {
	certsDir: string
	deviceId: string
	log?: (...message: any[]) => void
	debug?: (...message: any[]) => void
}): Promise<{ deviceId: string }> => {
	try {
		await fs.stat(certsDir)
	} catch {
		throw new Error(`${certsDir} does not exist.`)
	}

	log?.(`Generating key for device ${deviceId}`)

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

	log?.(`Generating CSR for device ${deviceId}`)

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

	return { deviceId }
}
