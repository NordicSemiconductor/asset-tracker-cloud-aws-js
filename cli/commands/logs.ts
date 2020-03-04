import { CloudFormation, CloudWatchLogs } from 'aws-sdk'
import { ComandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'

export const logsCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): ComandDefinition => ({
	command: 'logs',
	action: async () => {
		const cf = new CloudFormation({ region })
		const logs = new CloudWatchLogs({ region })

		const logGroups =
			(
				await cf.describeStackResources({ StackName: stackId }).promise()
			).StackResources?.filter(
				({ ResourceType }) => ResourceType === 'AWS::Logs::LogGroup',
			)?.map(({ PhysicalResourceId }) => PhysicalResourceId as string) ??
			([] as string[])

		const streams = await Promise.all(
			logGroups.map(async logGroupName => {
				const { logStreams } = await logs
					.describeLogStreams({
						logGroupName,
						orderBy: 'LastEventTime',
						descending: true,
						limit: 10,
					})
					.promise()
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
					logStreams.map(async logStreamName =>
						logs
							.getLogEvents({
								logGroupName,
								logStreamName,
								startFromHead: false,
								limit: 100,
							})
							.promise(),
					),
				)
				console.log(chalk.yellow(logGroupName))
				l.forEach(x => {
					x.events
						?.filter(
							({ message }) =>
								!/^(START|END|REPORT) RequestId:/.test(message || ''),
						)
						?.filter(({ message }) => message?.includes('\tERROR\t'))
						?.forEach(e => console.log(e.message?.trim()))
				})
			}),
		)
	},
	help: 'Query log files',
})
