import * as program from 'commander'
import { connect } from './device/connect'
import chalk from 'chalk'
import { Iot, CodePipeline } from 'aws-sdk'
import { stackOutput } from './cloudformation/stackOutput'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import * as path from 'path'
import { stackOutputToCRAEnvironment } from './cloudformation/stackOutputToCRAEnvironment'
import { registerCA } from './jitp/registerCA'
import { generateDeviceCertificate } from './jitp/generateDeviceCertificate'
import { randomWords } from '@bifravst/random-words'
import { distanceInWords } from 'date-fns'

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
		.on('--help', () => {
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
		.on('--help', () => {
			console.log('')
			console.log(
				chalk.yellow(
					'Prints the stack outputs as create-react-app environment variables.',
				),
			)
			console.log('')
		})

	program
		.command('register-ca')
		.action(async () => {
			ran = true
			try {
				const { certificateId } = await registerCA({
					stackId: process.env.STACK_ID || 'bifravst',
					certsDir: path.resolve(process.cwd(), 'certificates'),
					region: process.env.AWS_DEFAULT_REGION,
					log: (...message: any[]) => {
						console.log(...message.map(m => chalk.magenta(m)))
					},
					debug: (...message: any[]) => {
						console.log(...message.map(m => chalk.cyan(m)))
					},
				})
				console.log(
					chalk.green(
						`CA certificate ${chalk.yellow(certificateId)} registered.`,
					),
				)
				console.log(chalk.green('You can now generate device certificates.'))
			} catch (e) {
				console.error(chalk.red(e))
				process.exit(1)
			}
		})
		.on('--help', () => {
			console.log('')
			console.log(chalk.yellow('Registers a CA for Just-in-time provisioning.'))
			console.log('')
		})

	program
		.command('generate-cert')
		.option(
			'-d, --deviceId <deviceId>',
			'Device ID, if left blank a random ID will be generated',
		)
		.action(async ({ deviceId }) => {
			ran = true
			const id = deviceId || (await randomWords({ numWords: 3 })).join('-')
			await generateDeviceCertificate({
				deviceId: id,
				certsDir: path.resolve(process.cwd(), 'certificates'),
				log: (...message: any[]) => {
					console.log(...message.map(m => chalk.magenta(m)))
				},
				debug: (...message: any[]) => {
					console.log(...message.map(m => chalk.cyan(m)))
				},
			})
			console.log(
				chalk.green(`Certificate for device ${chalk.yellow(id)} generated.`),
			)
			console.log(chalk.green('You can now connect to the broker.'))
		})
		.on('--help', () => {
			console.log('')
			console.log(
				chalk.yellow(
					'Generate a certificate for a device, signed with the CA.',
				),
			)
			console.log('')
		})

	program
		.command('cd')
		.action(async () => {
			ran = true
			const cp = new CodePipeline({
				region,
			})
			const pipelines = [
				'bifravst-continuous-deployment',
				'bifravst-continuous-deployment-deviceUICD',
				'bifravst-continuous-deployment-webAppCD',
			] as const
			const statuses = await Promise.all(
				pipelines.map(async name =>
					cp
						.listPipelineExecutions({
							pipelineName: name,
							maxResults: 1,
						})
						.promise()
						.then(({ pipelineExecutionSummaries }) => ({
							pipelineName: name,
							summary: {
								status: 'Unknown',
								lastUpdateTime: new Date(),
								...(pipelineExecutionSummaries &&
									pipelineExecutionSummaries[0]),
							},
						}))
						.catch(() => ({
							pipelineName: name,
							summary: {
								status: 'Unknown',
								lastUpdateTime: new Date(),
							},
						})),
				),
			)
			statuses.forEach(({ pipelineName, summary }) => {
				console.log(
					({
						Succeeded: chalk.green.inverse('  OK  '),
						InProgress: chalk.yellow.inverse(' In Progress '),
						Superseded: chalk.gray('[Superseded]'),
						Failed: chalk.red.inverse('  ERR '),
						Unknown: chalk.bgRedBright('  ?? '),
					} as { [key: string]: any })[summary.status || 'Unknown'],
					chalk.cyan(pipelineName),
					chalk.gray(
						`${distanceInWords(new Date(), summary.lastUpdateTime)} ago`,
					),
				)
			})
		})
		.on('--help', () => {
			console.log('')
			console.log(chalk.yellow('Show continuous deployment status'))
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
