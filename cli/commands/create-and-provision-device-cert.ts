import {
	atHostHexfile,
	connect,
	createPrivateKeyAndCSR,
	flashCertificate,
	getIMEI,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import chalk from 'chalk'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
	createDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../jitp/createDeviceCertificate.js'
import { deviceFileLocations } from '../jitp/deviceFileLocations.js'
import { run } from '../process/run.js'
import { CommandDefinition } from './CommandDefinition.js'

export const defaultPort = '/dev/ttyACM0'
export const defaultSecTag = 42

export const createAndProvisionDeviceCertCommand = ({
	certsDir,
}: {
	certsDir: string
}): CommandDefinition => ({
	command: 'create-and-provision-device-cert',
	options: [
		{
			flags: '-e, --expires <expires>',
			description: `Validity of device certificate in days. Defaults to ${defaultDeviceCertificateValidityInDays} days.`,
		},
		{
			flags: '-p, --port <port>',
			description: `The port the device is connected to, defaults to ${defaultPort}`,
		},
		{
			flags: '--dk',
			description: `Connected device is a 9160 DK`,
		},
		{
			flags: '-s, --sec-tag <secTag>',
			description: `Use this secTag, defaults to ${defaultSecTag}`,
		},
		{
			flags: '-X, --delete-private-key',
			description: `Delete the private key (needed if a private key exists with the secTag)`,
		},
		{
			flags: '-a, --at-host <atHost>',
			description: `Flash at_host from this file`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({
		dk,
		expires,
		port,
		atHost,
		secTag,
		debug,
		deletePrivateKey,
	}) => {
		console.log(
			chalk.magenta(`Flashing certificate`),
			chalk.blue(port ?? defaultPort),
		)

		const connection = await connect({
			atHostHexfile:
				atHost ??
				(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
			device: port ?? defaultPort,
			warn: console.error,
			debug: debug === true ? console.debug : undefined,
			progress: debug === true ? console.log : undefined,
			inactivityTimeoutInSeconds: 10,
		})

		const deviceId = await getIMEI({ at: connection.connection.at })

		console.log(chalk.magenta(`IMEI`), chalk.blue(deviceId))

		const csr = await createPrivateKeyAndCSR({
			at: connection.connection.at,
			secTag: secTag ?? defaultSecTag,
			deletePrivateKey: deletePrivateKey ?? false,
		})

		const deviceFiles = deviceFileLocations({ certsDir, deviceId })

		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), path.sep))
		const deviceCSRDERLocation = path.join(tempDir, `${deviceId}-csr.der`)

		await fs.writeFile(deviceCSRDERLocation, csr)

		// Convert to PEM
		await run({
			command: 'openssl',
			args: [
				'req',
				'-inform',
				'DER',
				'-in',
				deviceCSRDERLocation,
				'-out',
				deviceFiles.csr,
			],
		})

		await createDeviceCertificate({
			deviceId,
			certsDir,
			log: (...message: any[]) => {
				console.log(...message.map((m) => chalk.magenta(m)))
			},
			debug: (...message: any[]) => {
				console.log(...message.map((m) => chalk.cyan(m)))
			},
			daysValid: expires !== undefined ? parseInt(expires, 10) : undefined,
		})
		console.log(
			chalk.green(
				`Certificate for device ${chalk.yellow(deviceId)} generated.`,
			),
		)

		await flashCertificate({
			at: connection.connection.at,
			caCert: await fs.readFile(
				path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
				'utf-8',
			),
			secTag: secTag ?? defaultSecTag,
			clientCert: await fs.readFile(deviceFiles.certWithCA, 'utf-8'),
		})

		await connection.connection.end()

		console.log()
		console.log(
			chalk.green('Certificate written to device'),
			chalk.blueBright(deviceId),
		)
	},
	help: 'Generate a certificate for the connected device using device-generated keys, signed with the CA, and flash it to the device.',
})
