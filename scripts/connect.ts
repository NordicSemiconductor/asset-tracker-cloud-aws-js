import * as path from 'path'
import { Iot } from 'aws-sdk'
import { device } from 'aws-iot-device-sdk'
import { deviceFileLocations } from './jitp/deviceFileLocations'
import chalk from 'chalk'

/**
 * Connect to the AWS IoT broker using a generated device certificate
 */
const main = async (args: { deviceId: string }) => {
	const { endpointAddress } = await new Iot({
		region: process.env.AWS_DEFAULT_REGION,
	})
		.describeEndpoint({ endpointType: 'iot:Data-ATS' })
		.promise()

	if (!endpointAddress) {
		throw new Error(`Failed to resolved AWS IoT endpoint`)
	}

	console.log(
		chalk.blue(`IoT broker hostname: ${chalk.yellow(endpointAddress)}`),
	)
	console.log(chalk.blue(`Device ID: ${chalk.yellow(args.deviceId)}`))

	const certsDir = path.resolve(process.cwd(), 'certificates')
	const deviceFiles = deviceFileLocations(certsDir, args.deviceId)

	console.time(chalk.green(chalk.inverse(' connected ')))

	const note = chalk.magenta(
		`Still connecting ... First connect takes around 30 seconds`,
	)
	console.time(note)
	const connectingNote = setInterval(() => {
		console.timeLog(note)
	}, 5000)

	const connection = new device({
		privateKey: deviceFiles.key,
		clientCert: deviceFiles.certWithCA,
		caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
		clientId: args.deviceId.trim(),
		host: endpointAddress,
		region: endpointAddress.split('.')[2],
	})

	connection.on('connect', async () => {
		console.timeEnd(chalk.green(chalk.inverse(' connected ')))
		clearInterval(connectingNote)
	})

	connection.on('close', () => {
		console.error(chalk.red(chalk.inverse(' disconnected! ')))
	})

	connection.on('reconnect', () => {
		console.log(chalk.magenta('reconnecting...'))
	})
}

main({ deviceId: process.argv[process.argv.length - 1] }).catch(error => {
	console.error(chalk.red(error))
	process.exit(1)
})
