import {
	FeatureRunner,
	ConsoleReporter,
	cognitoStepRunners,
	awsSdkStepRunners,
	storageStepRunners,
	restStepRunners,
	randomStepRunners,
	RestClient,
} from '@bifravst/e2e-bdd-test-runner'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import * as program from 'commander'
import * as chalk from 'chalk'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import { StackOutputs as FirmwareCIStackOutputs } from '../cdk/stacks/FirmwareCI'
import { bifravstStepRunners } from './steps/bifravst'
import { STS, CloudFormation, Iot, TimestreamQuery } from 'aws-sdk'
import { v4 } from 'uuid'
import { region } from '../cdk/regions'
import {
	CORE_STACK_NAME,
	FIRMWARE_CI_STACK_NAME,
} from '../cdk/stacks/stackName'
import { promises as fs } from 'fs'
import * as path from 'path'
import { firmwareCIStepRunners } from './steps/firmwareCI'
import { certsDir } from '../cli/jitp/certsDir'
import { timestreamStepRunners } from './steps/timestream'

let ran = false

export type BifravstWorld = StackOutputs & {
	accountId: string
	region: string
	userIotPolicyName: string
	historicaldataTableName: string
	historicaldataDatabaseName: string
	'firmwareCI:userAccessKeyId': string
	'firmwareCI:userSecretAccessKey': string
	'firmwareCI:thingGroupName': string
	'firmwareCI:bucketName': string
	awsIotRootCA: string
	certsDir: string
}

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option('-X, --no-retry', 'Do not retry steps')
	.option('-s, --stack <stack>', 'Stack name', CORE_STACK_NAME)
	.option(
		'-f, --firmware-ci-stack <stack>',
		'Firmware CI Stack name',
		FIRMWARE_CI_STACK_NAME,
	)
	.action(
		async (
			featureDir: string,
			options: {
				printResults: boolean
				stack: string
				firmwareCiStack: string
				progress: boolean
				retry: boolean
			},
		) => {
			ran = true
			const {
				printResults,
				stack: stackName,
				firmwareCiStack: ciStackName,
				progress,
				retry,
			} = options
			const cf = new CloudFormation({ region })
			const stackConfig = await stackOutput(cf)<StackOutputs>(stackName)

			const firmwareCIStackConfig = await stackOutput(
				cf,
			)<FirmwareCIStackOutputs>(ciStackName)

			const { Account: accountId } = await new STS({ region })
				.getCallerIdentity()
				.promise()

			const [
				historicaldataDatabaseName,
				historicaldataTableName,
			] = stackConfig.historicaldataTableInfo.split('|')

			const world: BifravstWorld = {
				...stackConfig,
				'firmwareCI:userAccessKeyId': firmwareCIStackConfig.userAccessKeyId,
				'firmwareCI:userSecretAccessKey':
					firmwareCIStackConfig.userSecretAccessKey,
				'firmwareCI:thingGroupName': firmwareCIStackConfig.thingGroupName,
				'firmwareCI:bucketName': firmwareCIStackConfig.bucketName,
				userIotPolicyName: stackConfig.userIotPolicyArn.split('/')[1],
				historicaldataTableName,
				historicaldataDatabaseName,
				region,
				accountId: accountId as string,
				awsIotRootCA: await fs.readFile(
					path.join(process.cwd(), 'data', 'AmazonRootCA1.pem'),
					'utf-8',
				),
				certsDir: await certsDir({
					iotEndpoint: stackConfig.mqttEndpoint,
					accountId: accountId as string,
				}),
			}

			console.log(chalk.yellow.bold(' World:'))
			console.log()
			console.log(world)
			console.log()

			const runner = new FeatureRunner<BifravstWorld>(world, {
				dir: featureDir,
				reporters: [
					new ConsoleReporter({
						printResults,
						printProgress: progress,
						printSummary: true,
					}),
				],
				retry,
			})

			try {
				const { success } = await runner
					.addStepRunners(
						cognitoStepRunners({
							...world,
							emailAsUsername: true,
						}),
					)
					.addStepRunners(
						awsSdkStepRunners({
							region: world.region,
							constructorArgs: {
								IotData: {
									endpoint: world.mqttEndpoint,
								},
							},
						}),
					)
					.addStepRunners(bifravstStepRunners(world))
					.addStepRunners(
						firmwareCIStepRunners({
							...world,
							iot: new Iot({ region }),
						}),
					)
					.addStepRunners(storageStepRunners())
					.addStepRunners(
						randomStepRunners({
							generators: {
								email: () => `${v4()}@example.com`,
								password: () =>
									((pw) =>
										`${pw[0].toUpperCase()}${pw.substr(1)}${Math.round(
											Math.random() * 1000,
										)}`)(
										Math.random()
											.toString(36)
											.replace(/[^a-z]+/g, ''),
									),
								UUID: (): string => v4(),
							},
						}),
					)
					.addStepRunners(
						restStepRunners({
							client: new RestClient({
								errorLog: (requestId: string, ...rest: any) => {
									console.error(
										' ',
										chalk.red.bold(' 🚨 '),
										chalk.red('RestClient'),
										chalk.grey(requestId),
									)
									rest.map((r: any) =>
										console.error(
											chalk.gray(
												JSON.stringify(r, null, 2)
													.split('\n')
													.map((s) => `       ${s}`)
													.join('\n'),
											),
										),
									)
								},
								debugLog: (requestId: string, ...rest: any) => {
									console.debug(
										' ',
										chalk.magenta(' ℹ '),
										chalk.cyan('RestClient'),
										chalk.grey(requestId),
									)
									rest.map((r: any) =>
										console.debug(
											chalk.grey(
												JSON.stringify(r, null, 2)
													.split('\n')
													.map((s) => `       ${s}`)
													.join('\n'),
											),
										),
									)
								},
							}),
						}),
					)
					.addStepRunners(
						timestreamStepRunners({
							timestream: new TimestreamQuery({ region }),
						}),
					)
					.run()
				if (!success) {
					process.exit(1)
					return
				}
				process.exit()
			} catch (error) {
				console.error(chalk.red('Running the features failed!'))
				console.error(error)
				process.exit(1)
			}
		},
	)
	.parse(process.argv)

if (!ran) {
	program.outputHelp(chalk.red)
	process.exit(1)
}
