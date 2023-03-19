import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { IoTClient } from '@aws-sdk/client-iot'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import {
	awsSdkStepRunners,
	cognitoStepRunners,
	ConsoleReporter,
	FeatureRunner,
	randomStepRunners,
	RestClient,
	restStepRunners,
	storageStepRunners,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { queryClient } from '@nordicsemiconductor/timestream-helpers'
import chalk from 'chalk'
import { program } from 'commander'
import { promises as fs } from 'fs'
import { randomUUID } from 'node:crypto'
import * as path from 'path'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint.js'
import type { StackOutputs } from '../cdk/stacks/AssetTracker/stack.js'
import type { StackOutputs as FirmwareCIStackOutputs } from '../cdk/stacks/FirmwareCI.js'
import {
	CORE_STACK_NAME,
	FIRMWARE_CI_STACK_NAME,
	HTTP_MOCK_HTTP_API_STACK_NAME,
} from '../cdk/stacks/stackName.js'
import type { StackOutputs as HttpApiMockStackOutputs } from '../cdk/test-resources/HttpApiMockStack.js'
import { certsDir } from '../cli/jitp/certsDir.js'
import { gpsDay } from '../pgps/gpsTime.js'
import { assetTrackerStepRunners } from './steps/asset-tracker.js'
import { httpApiMockStepRunners } from './steps/httpApiMock.js'
import { timestreamStepRunners } from './steps/timestream.js'

let ran = false

export type AssetTrackerWorld = typeof StackOutputs & {
	accountId: string
	userIotPolicyName: string
	historicaldataTableName: string
	historicaldataDatabaseName: string
	'firmwareCI:userAccessKeyId': string
	'firmwareCI:userSecretAccessKey': string
	'firmwareCI:bucketName': string
	awsIotRootCA: string
	certsDir: string
	mqttEndpoint: string
	'httpApiMock:requestsTableName': string
	'httpApiMock:responsesTableName': string
	'httpApiMock:apiURL': string
	region: string
	currentGpsDay: number
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
			const cf = new CloudFormationClient({})
			const stackConfig = await stackOutput(cf)<typeof StackOutputs>(stackName)
			const mqttEndpoint = await getIotEndpoint(new IoTClient({}))

			const firmwareCIStackConfig = await stackOutput(
				cf,
			)<FirmwareCIStackOutputs>(ciStackName)
			const httpApiMockStackConfig = await stackOutput(
				cf,
			)<HttpApiMockStackOutputs>(HTTP_MOCK_HTTP_API_STACK_NAME)

			const { Account: accountId } = await new STSClient({}).send(
				new GetCallerIdentityCommand({}),
			)

			const [historicaldataDatabaseName, historicaldataTableName] =
				stackConfig.historicaldataTableInfo.split('|') as [string, string]

			const world: AssetTrackerWorld = {
				...stackConfig,
				'firmwareCI:userAccessKeyId': firmwareCIStackConfig.userAccessKeyId,
				'firmwareCI:userSecretAccessKey':
					firmwareCIStackConfig.userSecretAccessKey,
				'firmwareCI:bucketName': firmwareCIStackConfig.bucketName,
				userIotPolicyName: stackConfig.userIotPolicyName,
				historicaldataTableName,
				historicaldataDatabaseName,
				accountId: accountId as string,
				awsIotRootCA: await fs.readFile(
					path.join(process.cwd(), 'data', 'AmazonRootCA1.pem'),
					'utf-8',
				),
				certsDir: await certsDir({
					iotEndpoint: mqttEndpoint,
					accountId: accountId as string,
				}),
				mqttEndpoint,
				'httpApiMock:requestsTableName':
					httpApiMockStackConfig.requestsTableName,
				'httpApiMock:responsesTableName':
					httpApiMockStackConfig.responsesTableName,
				'httpApiMock:apiURL': httpApiMockStackConfig.apiURL,
				region: mqttEndpoint.split('.')[2] as string,
				currentGpsDay: gpsDay(),
			}

			console.log(chalk.yellow.bold(' World:'))
			console.log()
			console.log(world)
			console.log()

			const runner = new FeatureRunner<AssetTrackerWorld>(world, {
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
							constructorArgs: {
								IotData: {
									endpoint: world.mqttEndpoint,
								},
							},
						}),
					)
					.addStepRunners(assetTrackerStepRunners(world))
					.addStepRunners(storageStepRunners())
					.addStepRunners(
						randomStepRunners({
							generators: {
								email: () => `${randomUUID()}@example.com`,
								password: () =>
									((pw) =>
										`${pw[0]?.toUpperCase()}${pw.slice(1)}${Math.round(
											Math.random() * 1000,
										)}`)(
										Math.random()
											.toString(36)
											.replace(/[^a-z]+/g, ''),
									),
								UUID: (): string => randomUUID(),
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
							timestream: await queryClient(),
						}),
					)
					.addStepRunners(
						httpApiMockStepRunners({
							db: new DynamoDBClient({}),
						}),
					)
					.run()
				if (!success) {
					process.exit(1)
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
