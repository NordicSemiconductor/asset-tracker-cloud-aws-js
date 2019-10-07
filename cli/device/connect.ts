import { promises as fs } from 'fs'
import { thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from '../jitp/deviceFileLocations'
import chalk from 'chalk'
import { uiServer } from './ui-server'
import { connection as WSConnection } from 'websocket'

const defaultConfig = {
	act: false, // Whether to enable the active mode
	actwt: 60, //In active mode: wait this amount of seconds until sending the next update. The actual interval will be this time plus the time it takes to get a GPS fix.
	mvres: 300, // (movement resolution) In passive mode: Time in seconds to wait after detecting movement before sending the next update
	mvt: 3600, // (movement timeout) In passive mode: Send update at least this often (in seconds)
	gpst: 60, // GPS timeout (in seconds): timeout for GPS fix
	celt: 600, // cellular timeout (in seconds): timeout for acquiring cellular connection
	acct: 1, // Accelerometer threshold: minimal absolute value for and accelerometer reading to be considered movement.
} as const

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
	const deviceFiles = deviceFileLocations({ certsDir, deviceId })
	let cfg = defaultConfig

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

	let wsConnection: WSConnection

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
				onWsConnection: c => {
					console.log(chalk.magenta('[ws]'), chalk.cyan('connected'))
					wsConnection = c
					connection.get(deviceId)
				},
			})
			console.log(
				chalk.magenta('>'),
				chalk.cyan(JSON.stringify({ state: { reported: { cfg } } })),
			)
			connection.update(deviceId, { state: { reported: { cfg } } })
		})

		connection.on('close', () => {
			console.error(chalk.red(chalk.inverse(' disconnected! ')))
		})

		connection.on('reconnect', () => {
			console.log(chalk.magenta('reconnecting...'))
		})

		connection.on('status', (_, stat, __, stateObject) => {
			console.log(chalk.magenta('>'), chalk.cyan(stat))
			console.log(chalk.magenta('>'), chalk.cyan(JSON.stringify(stateObject)))
			if (stat === 'accepted') {
				if (wsConnection) {
					cfg = {
						...cfg,
						...(stateObject.desired && stateObject.desired.cfg),
					}
					console.log(chalk.magenta('[ws>'), JSON.stringify(cfg))
					wsConnection.send(JSON.stringify(cfg))
				}
			}
		})

		connection.on('delta', (_, stateObject) => {
			console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(stateObject)))
			cfg = {
				...cfg,
				...(stateObject.state && stateObject.state.cfg),
			}
			if (wsConnection) {
				console.log(chalk.magenta('[ws>'), JSON.stringify(cfg))
				wsConnection.send(JSON.stringify(cfg))
			}
			console.log(
				chalk.magenta('>'),
				chalk.cyan(JSON.stringify({ state: { reported: { cfg } } })),
			)
			connection.update(deviceId, { state: { reported: { cfg } } })
		})

		connection.on('timeout', (thingName, clientToken) => {
			console.log(
				'received timeout on ' + thingName + ' with token: ' + clientToken,
			)
		})
	})
}
