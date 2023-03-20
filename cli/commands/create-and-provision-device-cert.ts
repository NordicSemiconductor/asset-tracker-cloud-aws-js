import {
	atHostHexfile,
	connect,
	createPrivateKeyAndCSR,
	flashCertificate,
	getIMEI,
	type Connection,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import chalk from 'chalk'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import {
	createDeviceCertificate,
	defaultDeviceCertificateValidityInDays,
} from '../jitp/createDeviceCertificate.js'
import { getCurrentCA } from '../jitp/currentCA.js'
import { deviceFileLocations } from '../jitp/deviceFileLocations.js'
import { readlineDevice } from '../jitp/readlineDevice.js'
import { run } from '../process/run.js'
import type { CommandDefinition } from './CommandDefinition.js'

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
		{
			flags: '-S, --simulated-device',
			description: `Use a simulated (soft) device. Useful if you do not have physical access to the device. Will print the AT commands sent to the device allows to provide responses on the command line.`,
		},
		{
			flags: '-c, --ca <caId>',
			description: `ID of the CA certificate to use. Defaults to the last created one.`,
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
		simulatedDevice,
		caId,
	}) => {
		let connection: Connection

		if (simulatedDevice === true) {
			console.log(
				chalk.magenta(`Flashing certificate`),
				chalk.blue('(simulated device)'),
			)
			connection = await readlineDevice()
		} else {
			console.log(
				chalk.magenta(`Flashing certificate`),
				chalk.blue(port ?? defaultPort),
			)
			connection = (
				await connect({
					atHostHexfile:
						atHost ??
						(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
					device: port ?? defaultPort,
					warn: console.error,
					debug: debug === true ? console.debug : undefined,
					progress: debug === true ? console.log : undefined,
					inactivityTimeoutInSeconds: 10,
				})
			).connection
		}

		const deviceId = await getIMEI({ at: connection.at })

		console.log(chalk.magenta(`IMEI`), chalk.blue(deviceId))

		const csr = await createPrivateKeyAndCSR({
			at: connection.at,
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
			caId: caId ?? getCurrentCA({ certsDir }),
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

		const caCert = await fs.readFile(
			path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
			'utf-8',
		)
		const clientCert = await fs.readFile(deviceFiles.certWithCA, 'utf-8')
		const effectiveSecTag = secTag ?? defaultSecTag

		if (simulatedDevice === true) {
			await connection.end()

			console.log('')
			console.log(
				chalk.white(
					'Please program the certificates using the certificate manager.',
				),
			)
			console.log('')
			console.log(
				chalk.whiteBright('for'),
				chalk.whiteBright.bold('CA certificate:'),
			)
			console.log(chalk.blueBright(caCert))
			console.log('')

			console.log(
				chalk.whiteBright('for'),
				chalk.whiteBright.bold('Client certificate:'),
			)
			console.log(chalk.blueBright(clientCert))
			console.log('')

			console.log(
				chalk.whiteBright('for'),
				chalk.whiteBright.bold('Security tag:'),
				chalk.blueBright(effectiveSecTag),
			)
			console.log('')
		} else {
			await flashCertificate({
				at: connection.at,
				caCert,
				secTag: effectiveSecTag,
				clientCert,
			})
			await connection.end()
		}

		console.log()
		console.log(
			chalk.green('Certificate written to device'),
			chalk.blueBright(deviceId),
		)

		process.exit()
	},
	help: 'Generate a certificate for the connected device using device-generated keys, signed with the CA, and flash it to the device.',
})
