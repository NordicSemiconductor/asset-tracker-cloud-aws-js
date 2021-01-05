import {
	TimestreamWriteClient,
	DescribeEndpointsCommand as DescribeWriteEndpointsCommand,
} from '@aws-sdk/client-timestream-write'

import {
	TimestreamQueryClient,
	DescribeEndpointsCommand as DescribeQueryEndpointsCommand,
} from '@aws-sdk/client-timestream-query'

export const getTimestreamWriteClient = async (): Promise<TimestreamWriteClient> =>
	new TimestreamWriteClient({})
		.send(new DescribeWriteEndpointsCommand({}))
		.then(
			({ Endpoints }) =>
				new TimestreamWriteClient({
					endpoint: `https://${
						Endpoints?.[0].Address ??
						`ingest-cell1.timestream.${
							process.env.AWS_REGION ?? 'us-east-1'
						}.amazonaws.com`
					}`,
				}),
		)

export const getTimestreamQueryClient = async (): Promise<TimestreamQueryClient> =>
	new TimestreamQueryClient({})
		.send(new DescribeQueryEndpointsCommand({}))
		.then(
			({ Endpoints }) =>
				new TimestreamQueryClient({
					endpoint: `https://${
						Endpoints?.[0].Address ??
						`query-cell1.timestream.${
							process.env.AWS_REGION ?? 'us-east-1'
						}.amazonaws.com`
					}`,
				}),
		)
