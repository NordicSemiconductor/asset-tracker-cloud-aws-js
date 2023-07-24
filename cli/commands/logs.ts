import {
	CloudFormationClient,
	DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation'
import {
	CloudWatchLogsClient,
	DeleteLogGroupCommand,
	DescribeLogStreamsCommand,
	GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName.js'
import type { CommandDefinition } from './CommandDefinition.js'

export const logsCommand = (): CommandDefinition => ({
	command: 'logs',
	options: [
		{
			flags: '-n, --numLogGroups <numLogGroups>',
			description: 'Number of logGroups to consider, default: 1',
		},
		{
			flags: '-s, --numLogStreams <numLogStreams>',
			description: 'Number of logStreams to consider, default: 100',
		},
		{
			flags: '-X, --deleteLogGroups',
			description: 'delete log groups afterwards',
		},
	],
	action: async ({ numLogGroups, numLogStreams, deleteLogGroups }) => {
		const cf = new CloudFormationClient({})
		const logs = new CloudWatchLogsClient({})

		const logGroups =
			(
				await cf.send(
					new DescribeStackResourcesCommand({ StackName: CORE_STACK_NAME }),
				)
			).StackResources?.filter(({ ResourceType }) =>
				['AWS::Logs::LogGroup', 'Custom::LogRetention'].includes(
					ResourceType ?? '',
				),
			)?.map(({ PhysicalResourceId }) => PhysicalResourceId as string) ??
			([] as string[])

		if (deleteLogGroups === true) {
			await Promise.all(
				logGroups.map(async (logGroupName) => {
					console.log(
						chalk.gray(`Deleting log group`),
						chalk.yellow(logGroupName),
					)
					return logs.send(
						new DeleteLogGroupCommand({
							logGroupName,
						}),
					)
				}),
			)
			return
		}

		const streams = await Promise.all(
			logGroups.map(async (logGroupName) => {
				const { logStreams } = await logs.send(
					new DescribeLogStreamsCommand({
						logGroupName,
						orderBy: 'LastEventTime',
						descending: true,
						limit: numLogGroups !== undefined ? parseInt(numLogGroups, 10) : 1,
					}),
				)

				return {
					logGroupName,
					logStreams:
						logStreams?.map(({ logStreamName }) => logStreamName as string) ??
						[],
				}
			}),
		)

		await Promise.all(
			streams.map(async ({ logGroupName, logStreams }) => {
				const l = await Promise.all(
					logStreams.map(async (logStreamName) =>
						logs.send(
							new GetLogEventsCommand({
								logGroupName,
								logStreamName,
								startFromHead: false,
								limit:
									numLogStreams !== undefined
										? parseInt(numLogStreams, 10)
										: 100,
							}),
						),
					),
				)
				console.log(chalk.yellow(logGroupName))
				l.forEach((x) => {
					x.events
						?.filter(
							({ message }) =>
								!/^(START|END|REPORT) RequestId:/.test(message ?? ''),
						)
						?.filter(({ message }) => message?.includes('\tERROR\t'))
						?.forEach((e) => console.log(e.message?.trim()))
				})
			}),
		)
	},
	help: 'Query log files',
})
