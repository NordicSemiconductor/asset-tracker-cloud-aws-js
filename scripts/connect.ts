import * as path from 'path'
import { Iot } from 'aws-sdk'
import { thingShadow } from 'aws-iot-device-sdk'
import { deviceFileLocations } from './jitp/deviceFileLocations'
import chalk from 'chalk'
import { uiServer } from './device/ui-server'
import { stackOutput } from './cloudformation/stackOutput'
import { StackOutputs } from '../cdk/stacks/Bifravst'

const stackId = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_DEFAULT_REGION

/**
 * Connect to the AWS IoT broker using a generated device certificate
 */
const main = async (args: { deviceId: string }) => {
	const clientId = args.deviceId
	if (!clientId || !clientId.length) {
		throw new Error('Must provide a device id!')
	}

	console.log(chalk.blue(`Device ID: ${chalk.yellow(clientId)}`))

	const [endpointAddress, deviceUiUrl] = await Promise.all([
		(async () => {
			console.log(chalk.magenta('Fetching IoT endpoint address ...'))
			const { endpointAddress } = await new Iot({
				region,
			})
				.describeEndpoint({ endpointType: 'iot:Data-ATS' })
				.promise()
			if (!endpointAddress) {
				throw new Error(`Failed to resolved AWS IoT endpoint`)
			}
			console.log(
				chalk.blue(`IoT broker hostname: ${chalk.yellow(endpointAddress)}`),
			)
			return endpointAddress
		})(),
		stackOutput<StackOutputs>({
			region,
			stackId,
		}).then(({ deviceUiDomainName }) => `https://${deviceUiDomainName}`),
	])

	const certsDir = path.resolve(process.cwd(), 'certificates')
	const deviceFiles = deviceFileLocations(certsDir, clientId)

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
		caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		clientId,
		host: endpointAddress,
		region: endpointAddress.split('.')[2],
	})

	connection.on('connect', async () => {
		console.timeEnd(chalk.green(chalk.inverse(' connected ')))
		clearInterval(connectingNote)

		connection.register(clientId, {}, async () => {
			await uiServer({
				deviceUiUrl,
				deviceId: clientId,
				onUpdate: update => {
					console.log(chalk.magenta('<'), chalk.cyan(JSON.stringify(update)))
					connection.update(clientId, { state: { reported: update } })
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

main({ deviceId: process.argv[process.argv.length - 1].trim() }).catch(
	error => {
		console.error(chalk.red(error))
		process.exit(1)
	},
)
