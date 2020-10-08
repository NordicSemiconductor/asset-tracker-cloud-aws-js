import * as chalk from 'chalk'
import { CodePipeline } from 'aws-sdk'
import { formatDistanceToNow } from 'date-fns'
import { CommandDefinition } from './CommandDefinition'
import { region } from '../../cdk/regions'
import { listPipelines } from '../cd/listPipelines'

export const cdCommand = (): CommandDefinition => ({
	command: 'cd',
	action: async () => {
		const pipelines = await listPipelines()
		const cp = new CodePipeline({ region })
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
