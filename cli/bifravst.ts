import * as program from 'commander'
import { connect } from './connect'
import chalk from 'chalk'
import { Iot } from 'aws-sdk'
import { stackOutput } from '../scripts/cloudformation/stackOutput'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import * as path from 'path'
import { stackOutputToCRAEnvironment } from '../scripts/cloudformation/stackOutputToCRAEnvironment'

const stackId = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_DEFAULT_REGION
const iot = new Iot({
	region,
})

const config = async () => {
	const [endpoint, { deviceUiDomainName }] = await Promise.all([
		iot
			.describeEndpoint({ endpointType: 'iot:Data-ATS' })
			.promise()
			.then(({ endpointAddress }) => `${endpointAddress}`),
		stackOutput<StackOutputs>({
			region,
			stackId,
		}),
	])

	return {
		endpoint,
		deviceUiUrl: `https://${deviceUiDomainName}`,
	}
}

const bifravstCLI = async () => {
	let ran = false

	const { endpoint, deviceUiUrl } = await config()
	const certsDir = path.resolve(process.cwd(), 'certificates')

	program.description('Bifravst Command Line Interface')

	program
		.command('connect <deviceId>')
		.option('-e, --endpoint <endpoint>', 'MQTT broker endpoint', endpoint)
		.action(async (deviceId: string) => {
			ran = true
			await connect({
				deviceId,
				deviceUiUrl,
				endpoint,
				certsDir,
				caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
			})
		})
		.on('--help', function() {
			console.log('')
			console.log(
				chalk.yellow(
					'Connect to the AWS IoT broker using a generated device certificate.',
				),
			)
			console.log('')
		})

	program
		.command('react-config')
		.action(async () => {
			ran = true
			process.stdout.write(
				await stackOutputToCRAEnvironment({
					stackId,
					region,
				}),
			)
		})
		.on('--help', function() {
			console.log('')
			console.log(
				chalk.yellow(
					'Prints the stack outputs as create-react-app environment variables.',
				),
			)
			console.log('')
		})

	program.parse(process.argv)

	if (!ran) {
		program.outputHelp(chalk.yellow)
		throw new Error('No command selected!')
	}
}

bifravstCLI().catch(err => {
	console.error(chalk.red(err))
	process.exit(1)
})
