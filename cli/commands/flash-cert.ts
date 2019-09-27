import { ComandDefinition } from './CommandDefinition'
import { ModemPort } from 'modemtalk'
import chalk from 'chalk'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import { promises as fs } from 'fs'
import * as path from 'path'

export const flashCertificate = ({
	certsDir,
}: {
	certsDir: string
}): ComandDefinition => ({
	command: 'flash <deviceId>',
	options: [
		{
			flags: '-p, --port <port>',
			description: 'Serial port, defaults to /dev/ttyACM0',
		},
		{
			flags: '-t, --sectag <sectag>',
			description: 'sec tag, defaults to 42',
		},
	],
	action: async (
		deviceId: string,
		{ port, sectag }: { port?: string; sectag?: string },
	) => {
		const deviceFiles = deviceFileLocations({ certsDir, deviceId })
		const PORT = port || '/dev/ttyACM0'
		const SEC_TAG = parseInt(sectag || '', 10) || 42
		const device = new ModemPort(PORT, {
			writeCallback: (data: string) => {
				console.log(chalk.magenta(data.trim()))
			},
		})

		device.on('event', (...args: any) => {
			console.log('even', JSON.stringify(args))
		})
		device.on('error', (err: Error) => {
			console.error(chalk.red(`Serial port error: ${err.message}`))
		})
		device.on('disconnect', () => {
			console.log(chalk.magenta('Serial port has been disconnected'))
		})
		device.on('rx', (data: string) => {
			console.debug(chalk.grey.bold('device <<'), chalk.grey(data.trim()))
		})

		await device.open()

		const [caCert, clientCert, privateKey] = await Promise.all([
			fs.readFile(
				path.join(process.cwd(), 'data', 'AmazonRootCA1.pem'),
				'utf-8',
			),
			fs.readFile(deviceFiles.certWithCA, 'utf-8'),
			fs.readFile(deviceFiles.key, 'utf-8'),
		])

		console.log(chalk.yellow('Port:'), chalk.cyan(PORT))
		console.log(chalk.yellow('SecTag:'), chalk.cyan(`${SEC_TAG}`))

		await device.writeAT('+CGSN', {
			timeout: 2000,
		})
		// FIXME: How to read the response?

		console.log(chalk.cyan('Turning off modem'))
		await device.writeAT('+CFUN=4', {
			timeout: 2000,
		})

		console.log(chalk.cyan('Writing credentials'))
		await device.writeTLSCredential(SEC_TAG, 0, caCert) // CA certificate
		await device.writeTLSCredential(SEC_TAG, 1, clientCert) // client certificate
		await device.writeTLSCredential(SEC_TAG, 2, privateKey) // private key

		await device.close()

		console.log(chalk.yellow('Done. Restart the device now.'))
	},
	help: 'Flash the certificate onto the device',
})
