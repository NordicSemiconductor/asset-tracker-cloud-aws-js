import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { S3, CloudFormation } from 'aws-sdk'
import * as chalk from 'chalk'

export const purgeBucketsCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): CommandDefinition => ({
	command: 'purge-buckets',
	action: async () => {
		const {
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
		} = {
			...(await stackOutput(new CloudFormation({ region }))(stackId)),
		} as { [key: string]: string }
		const buckets = [
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
		]
		console.log('Purging bucket:')
		buckets
			.filter((b) => b)
			.forEach((b) => console.log(chalk.grey('-'), chalk.yellow(b)))

		const s3 = new S3({ region })
		await Promise.all(
			buckets
				.filter((b) => b)
				.map(async (bucketName) => {
					console.log('Purging bucket', bucketName)
					const { Contents } = await s3
						.listObjects({ Bucket: bucketName })
						.promise()
					if (!Contents) {
						console.log(`${bucketName} is empty.`)
						return
					}
					return Promise.all(
						Contents.map(async (obj) => {
							console.log(bucketName, obj.Key)
							return s3
								.deleteObject({
									Bucket: bucketName,
									Key: `${obj.Key}`,
								})
								.promise()
						}),
					)
				}),
		)
	},
	help: 'Purges all S3 buckets (used during CI runs)',
})
