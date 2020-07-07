import {
	FeatureRunner,
	ConsoleReporter,
	cognitoStepRunners,
	awsSdkStepRunners,
	storageStepRunners,
	restStepRunners,
	randomStepRunners,
} from '@bifravst/e2e-bdd-test-runner'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import * as program from 'commander'
import * as chalk from 'chalk'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import { bifravstStepRunners } from './steps/bifravst'
import {
	DataBaseName,
	UpdatesTableName,
	WorkGroupName,
} from '../historicalData/settings'
import { athenaStepRunners } from './steps/athena'
import { uuidHelper } from './steps/uuidHelper'
import { STS, CloudFormation } from 'aws-sdk'
import { v4 } from 'uuid'
import { region } from '../cdk/regions'
import { stackId } from '../cdk/stacks/stackId'

let ran = false

export type BifravstWorld = StackOutputs & {
	accountId: string
	region: string
	userIotPolicyName: string
	historicaldataWorkgroupName: string
	historicaldataDatabaseName: string
	historicaldataTableName: string
}

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option('-X, --no-retry', 'Do not retry steps')
	.option('-s, --stack <stack>', 'Stack name', stackId())
	.action(
		async (
			featureDir: string,
			options: {
				printResults: boolean
				stack: string
				progress: boolean
				retry: boolean
			},
		) => {
			ran = true
			const { printResults, stack: stackName, progress, retry } = options

			const stackConfig = await stackOutput(new CloudFormation({ region }))<
				StackOutputs
			>(stackName)

			const { Account: accountId } = await new STS({ region })
				.getCallerIdentity()
				.promise()

			const world: BifravstWorld = {
				...stackConfig,
				userIotPolicyName: stackConfig.userIotPolicyArn.split('/')[1],
				historicaldataWorkgroupName: WorkGroupName(),
				historicaldataDatabaseName: DataBaseName(),
				historicaldataTableName: UpdatesTableName(),
				region,
				accountId: accountId as string,
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
						printProgressTimestamps: true,
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
					.addStepRunners(athenaStepRunners(world))
					.addStepRunners(bifravstStepRunners(world))
					.addStepRunners([uuidHelper])
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
							},
						}),
					)
					.addStepRunners(restStepRunners())
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
