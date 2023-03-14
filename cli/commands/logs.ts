import {
	CloudFormationClient,
	DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation'
import {
	CloudWatchLogsClient,
	DescribeLogStreamsCommand,
	GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs'
import chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { CommandDefinition } from './CommandDefinition'

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
	],
	action: async ({ numLogGroups, numLogStreams }) => {
		const cf = new CloudFormationClient({})
		const logs = new CloudWatchLogsClient({})

		const logGroups =
			(
				await cf.send(
					new DescribeStackResourcesCommand({ StackName: CORE_STACK_NAME }),
				)
			).StackResources?.filter(
				({ ResourceType }) => ResourceType === 'AWS::Logs::LogGroup',
			)?.map(({ PhysicalResourceId }) => PhysicalResourceId as string) ??
			([] as string[])

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
