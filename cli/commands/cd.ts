import * as chalk from 'chalk'
import { CodePipeline } from 'aws-sdk'
import { formatDistanceToNow } from 'date-fns'
import { CommandDefinition } from './CommandDefinition'

export const cdCommand = (): CommandDefinition => ({
	command: 'cd',
	action: async () => {
		const cp = new CodePipeline({})
		const pipelines = [
			'bifravst-continuous-deployment',
			'bifravst-continuous-deployment-deviceUICD',
			'bifravst-continuous-deployment-webAppCD',
		] as const
		const statuses = await Promise.all(
			pipelines.map(async (name) =>
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
							...pipelineExecutionSummaries?.[0],
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
					formatDistanceToNow(summary.lastUpdateTime, { addSuffix: true }),
				),
			)
		})
	},
	help: 'Show continuous deployment status',
})
