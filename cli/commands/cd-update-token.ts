import { CodePipeline, SSM } from 'aws-sdk'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { region } from '../../cdk/regions'
import { listPipelines } from '../cd/listPipelines'

export const cdUpdateTokenCommand = (): CommandDefinition => ({
	command: 'cd-update-token <token>',
	action: async (token: string) => {
		const ssm = new SSM({ region })
		try {
			await ssm
				.deleteParameter({
					Name: '/codebuild/github-token',
				})
				.promise()
		} catch {
			// pass
		}
		await ssm
			.putParameter({
				Name: '/codebuild/github-token',
				Value: token,
				Type: 'String',
			})
			.promise()
		const cp = new CodePipeline({ region })
		const pipelines = await listPipelines()
		await Promise.all(
			pipelines.map(async (name) => {
				const { pipeline } = await cp
					.getPipeline({
						name: name,
					})
					.promise()

				if (pipeline) {
					console.log(JSON.stringify(pipeline, null, 2))
					await cp
						.updatePipeline({
							pipeline: {
								...pipeline,
								stages: [
									...pipeline.stages.map((stage) => ({
										...stage,
										actions: [
											...stage.actions.map((action) => ({
												...action,
												configuration: {
													...action.configuration,
													...(action.configuration?.OAuthToken !== undefined
														? { OAuthToken: token }
														: {}),
												},
											})),
										],
									})),
								],
							},
						})
						.promise()
					console.log(chalk.green(`${name}`))
				}
			}),
		)
	},
	help: 'Show continuous deployment status',
})
