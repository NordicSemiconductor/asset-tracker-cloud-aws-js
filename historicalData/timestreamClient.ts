import {
	TimestreamWriteClient,
	DescribeEndpointsCommand as DescribeWriteEndpointsCommand,
} from '@aws-sdk/client-timestream-write'

import {
	TimestreamQueryClient,
	DescribeEndpointsCommand as DescribeQueryEndpointsCommand,
} from '@aws-sdk/client-timestream-query'

export const getTimestreamWriteClient = async (
	{
		region,
	}: {
		region?: string
	} = { region: process.env.AWS_REGION },
): Promise<TimestreamWriteClient> =>
	new TimestreamWriteClient({ region })
		.send(new DescribeWriteEndpointsCommand({ region }))
		.then(
			({ Endpoints }) =>
				new TimestreamWriteClient({
					endpoint: `https://${
						Endpoints?.[0].Address ??
						`ingest-cell1.timestream.${region}.amazonaws.com`
					}`,
				}),
		)

export const getTimestreamQueryClient = async (
	{
		region,
	}: {
		region?: string
	} = { region: process.env.AWS_REGION },
): Promise<TimestreamQueryClient> =>
	new TimestreamQueryClient({ region })
		.send(new DescribeQueryEndpointsCommand({ region }))
		.then(
			({ Endpoints }) =>
				new TimestreamQueryClient({
					endpoint: `https://${
						Endpoints?.[0].Address ??
						`query-cell1.timestream.${region}.amazonaws.com`
					}`,
				}),
		)
