import * as chalk from 'chalk'
import {
	CodePipelineClient,
	ListPipelineExecutionsCommand,
} from '@aws-sdk/client-codepipeline'
import { formatDistanceToNow } from 'date-fns'
import { CommandDefinition } from './CommandDefinition'
import { region } from '../../cdk/regions'
import { listPipelines } from '../cd/listPipelines'

export const cdCommand = (): CommandDefinition => ({
	command: 'cd',
	action: async () => {
		const pipelines = await listPipelines()
		const cp = new CodePipelineClient({ region })
		const statuses = await Promise.all(
			pipelines.map(async (name) =>
				cp
					.send(
						new ListPipelineExecutionsCommand({
							pipelineName: name,
							maxResults: 1,
						}),
					)
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
