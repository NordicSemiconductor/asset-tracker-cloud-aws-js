import {
	CodePipelineClient,
	GetPipelineCommand,
	UpdatePipelineCommand,
} from '@aws-sdk/client-codepipeline'
import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { putSettings } from '../../util/settings'
import { listPipelines } from '../cd/listPipelines'
import { CommandDefinition } from './CommandDefinition'

export const cdUpdateTokenCommand = (): CommandDefinition => ({
	command: 'cd-update-token <token>',
	action: async (token: string) => {
		const ssm = new SSMClient({})

		await putSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope: 'codebuild',
			system: 'github',
		})({
			property: 'token',
			value: token,
		})

		const cp = new CodePipelineClient({})
		const pipelines = await listPipelines()
		await Promise.all(
			pipelines.map(async (name) => {
				const { pipeline } = await cp.send(
					new GetPipelineCommand({
						name: name,
					}),
				)
				if (pipeline !== undefined) {
					console.log(JSON.stringify(pipeline, null, 2))
					await cp.send(
						new UpdatePipelineCommand({
							pipeline: {
								...pipeline,
								stages: [
									...(pipeline.stages?.map((stage) => ({
										...stage,
										actions: [
											...(stage.actions?.map((action) => ({
												...action,
												configuration: {
													...action.configuration,
													...(action.configuration?.OAuthToken !== undefined
														? { OAuthToken: token }
														: {}),
												},
											})) ?? []),
										],
									})) ?? []),
								],
							},
						}),
					)
					console.log(chalk.green(`${name}`))
				}
			}),
		)
	},
	help: 'Update the GitHub token used in the continuous deployment pipeline',
})
