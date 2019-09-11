import {
	FeatureRunner,
	fetchStackConfiguration,
	ConsoleReporter,
	cognitoStepRunners,
	awsSdkStepRunners,
} from '@coderbyheart/bdd-feature-runner-aws'
import * as program from 'commander'
import chalk from 'chalk'
import { StackOutputs } from '../cdk/stacks/Bifravst'

let ran = false

program
	.arguments('<featureDir>')
	.option('-r, --print-results', 'Print results')
	.option('-p, --progress', 'Print progress')
	.option(
		'-s, --stack <stack>',
		'Stack name',
		process.env.STACK_ID || 'bifravst',
	)
	.action(
		async (
			featureDir: string,
			{
				printResults,
				stack: stackName,
				progress,
			}: { printResults: boolean; stack: string; progress: boolean },
		) => {
			ran = true

			const stackConfig = (await fetchStackConfiguration(
				stackName,
			)) as StackOutputs

			const world: StackOutputs & {
				region: string
				userIotPolicyName: string
			} = {
				...stackConfig,
				userIotPolicyName: stackConfig.userIotPolicyArn.split('/')[1],
				region:
					process.env.AWS_DEFAULT_REGION ||
					process.env.AWS_REGION ||
					'eu-central-1',
			}

			console.log(chalk.yellow.bold(' World:'))
			console.log()
			console.log(world)
			console.log()

			const runner = new FeatureRunner<StackOutputs>(world, {
				dir: featureDir,
				reporters: [
					new ConsoleReporter({
						printResults,
						printProgress: progress,
					}),
				],
			})

			try {
				const { success } = await runner
					.addStepRunners(
						cognitoStepRunners<StackOutputs & { region: string }>({
							...world,
							emailAsUsername: true,
						}),
					)
					.addStepRunners(awsSdkStepRunners(world))
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
