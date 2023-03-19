import type { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import type { IoTClient, Tag } from '@aws-sdk/client-iot'
import { randomUUID } from 'crypto'
import { mkdir, stat, unlink } from 'fs/promises'
import { run } from '../process/run.js'
import { caFileLocations } from './caFileLocations.js'
import { registerCA } from './registerCA.js'

export const defaultCAValidityInDays = 356

/**
 * Creates a CA certificate and registers it for Just-in-time provisioning
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/device-certs-your-own.html
 */
export const createCA = async (args: {
	certsDir: string
	iot: IoTClient
	cf: CloudFormationClient
	stack: string
	subject?: string
	attributes?: Record<string, string>
	log: (...message: any[]) => void
	debug: (...message: any[]) => void
	daysValid?: number
	tags?: Tag[]
}): Promise<{ certificateId: string }> => {
	const { certsDir, log, debug, iot, cf } = args
	try {
		await stat(certsDir)
	} catch {
		await mkdir(certsDir)
		log(`Created ${certsDir}`)
	}

	const caFiles = caFileLocations({ id: randomUUID(), certsDir })

	await run({
		command: 'openssl',
		args: ['genrsa', '-out', caFiles.key, '2048'],
		log: debug,
	})

	await run({
		command: 'openssl',
		args: [
			'req',
			'-x509',
			'-new',
			'-nodes',
			'-key',
			caFiles.key,
			'-sha256',
			'-days',
			`${args.daysValid ?? defaultCAValidityInDays}`,
			'-out',
			caFiles.cert,
			'-subj',
			`/OU=${args.subject ?? args.stack}`,
		],
		log: debug,
	})

	const { certificateId } = await registerCA({
		iot,
		cf,
		certsDir,
		stack: args.stack,
		caCertificateFile: caFiles.cert,
		caCertificateKeyFile: caFiles.key,
		attributes: args.attributes,
		tags: args.tags,
		log,
		debug,
	})

	await Promise.all([unlink(caFiles.cert), unlink(caFiles.key)])

	return {
		certificateId,
	}
}
