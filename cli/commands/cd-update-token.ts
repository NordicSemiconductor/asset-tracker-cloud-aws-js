import {
	CodePipelineClient,
	GetPipelineCommand,
	UpdatePipelineCommand,
} from '@aws-sdk/client-codepipeline'
import {
	DeleteParameterCommand,
	PutParameterCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { listPipelines } from '../cd/listPipelines'

export const cdUpdateTokenCommand = (): CommandDefinition => ({
	command: 'cd-update-token <token>',
	action: async (token: string) => {
		const ssm = new SSMClient({})
		try {
			await ssm.send(
				new DeleteParameterCommand({
					Name: '/codebuild/github-token',
				}),
			)
		} catch {
			// pass
		}
		await ssm.send(
			new PutParameterCommand({
				Name: '/codebuild/github-token',
				Value: token,
				Type: 'String',
			}),
		)

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
	help: 'Show continuous deployment status',
})
