import {
	FeatureRunner,
	fetchStackConfiguration,
	ConsoleReporter,
	cognitoStepRunners,
	awsSdkStepRunners,
	storageStepRunners,
	restStepRunners,
} from '@coderbyheart/bdd-feature-runner-aws'
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
import { STS } from 'aws-sdk'

let ran = false

export type BifravstWorld = StackOutputs & {
	accountId: string
	region: string
	userIotPolicyName: string
	historicaldataWorkgroupName: string
	historicaldataDatabaseName: string
	historicaldataTableName: string
}

const region =
	process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'eu-central-1'

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option('-X, --no-retry', 'Do not retry steps')
	.option(
		'-s, --stack <stack>',
		'Stack name',
		process.env.STACK_ID || 'bifravst',
	)
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

			const stackConfig = (await fetchStackConfiguration({
				StackName: stackName,
				region,
			})) as StackOutputs

			const { Account: accountId } = await new STS({ region })
				.getCallerIdentity()
				.promise()

			const world: BifravstWorld = {
				...stackConfig,
				userIotPolicyName: stackConfig.userIotPolicyArn.split('/')[1],
				historicaldataWorkgroupName: WorkGroupName({
					bifravstStackName: stackName,
				}),
				historicaldataDatabaseName: DataBaseName({
					bifravstStackName: stackName,
				}),
				historicaldataTableName: UpdatesTableName({
					bifravstStackName: stackName,
				}),
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
