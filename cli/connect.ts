import { promises as fs } from 'fs'
import { thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../scripts/jitp/deviceFileLocations'
import chalk from 'chalk'
import { uiServer } from '../scripts/device/ui-server'

/**
 * Connect to the AWS IoT broker using a generated device certificate
 */
export const connect = async (args: {
	deviceId: string
	endpoint: string
	deviceUiUrl: string
	certsDir: string
	caCert: string
}) => {
	const { deviceId, deviceUiUrl, certsDir, endpoint, caCert } = args
	const deviceFiles = deviceFileLocations(certsDir, deviceId)

	console.log(chalk.blue('Device ID:   '), chalk.yellow(deviceId))
	console.log(chalk.blue('endpoint:    '), chalk.yellow(endpoint))
	console.log(chalk.blue('deviceUiUrl: '), chalk.yellow(deviceUiUrl))
	console.log(chalk.blue('CA cert:     '), chalk.yellow(caCert))
	console.log(chalk.blue('Private key: '), chalk.yellow(deviceFiles.key))
	console.log(chalk.blue('Certificate: '), chalk.yellow(deviceFiles.certWithCA))

	const certFiles = [deviceFiles.certWithCA, deviceFiles.key, caCert]

	try {
		await Promise.all(
			certFiles.map(async f => {
				try {
					await fs.stat(f)
					console.log(chalk.green('✔'), chalk.magenta(f))
				} catch (e) {
					console.log(chalk.red('✖'), chalk.magenta(f))
					throw e
				}
			}),
		)
	} catch (error) {
		console.error(
			chalk.red(`Could not find certificates for device ${deviceId}!`),
		)
		process.exit(1)
	}

	console.time(chalk.green(chalk.inverse(' connected ')))

	const note = chalk.magenta(
		`Still connecting ... First connect takes around 30 seconds`,
	)
	console.time(note)
	const connectingNote = setInterval(() => {
		console.timeLog(note)
	}, 5000)

	const connection = new thingShadow({
		privateKey: deviceFiles.key,
		clientCert: deviceFiles.certWithCA,
		caCert,
		clientId: deviceId,
		host: endpoint,
		region: endpoint.split('.')[2],
	})

	connection.on('connect', async () => {
		console.timeEnd(chalk.green(chalk.inverse(' connected ')))
		clearInterval(connectingNote)

		connection.register(deviceId, {}, async () => {
			await uiServer({
				deviceUiUrl,
				deviceId: deviceId,
				onUpdate: update => {
					console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(update)))
					connection.update(deviceId, { state: { reported: update } })
				},
			})
		})

		connection.on('close', () => {
			console.error(chalk.red(chalk.inverse(' disconnected! ')))
		})

		connection.on('reconnect', () => {
			console.log(chalk.magenta('reconnecting...'))
		})

		connection.on('status', (_, stat) => {
			console.log(chalk.magenta('>'), chalk.cyan(stat))
		})

		connection.on('delta', function(thingName, stateObject) {
			console.log(
				'received delta on ' + thingName + ': ' + JSON.stringify(stateObject),
			)
		})

		connection.on('timeout', function(thingName, clientToken) {
			console.log(
				'received timeout on ' + thingName + ' with token: ' + clientToken,
			)
		})
	})
}
