import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { S3, CloudFormation } from 'aws-sdk'
import * as chalk from 'chalk'
import { retry } from './retry'
import { region } from '../../cdk/regions'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackId'

export const purgeBucketsCommand = (): CommandDefinition => ({
	command: 'purge-buckets',
	action: async () => {
		const {
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
			fotaBucketName,
		} = {
			...(await stackOutput(new CloudFormation({ region }))(CORE_STACK_NAME)),
		} as { [key: string]: string }
		const buckets = [
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
			fotaBucketName,
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
					try {
						await retry(
							3,
							() => 5000,
						)(async () => {
							const { Contents } = await s3
								.listObjects({ Bucket: bucketName })
								.promise()
							if (!Contents) {
								console.log(`${bucketName} is empty.`)
							} else {
								await Promise.all(
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
							}
							await s3.deleteBucket({ Bucket: bucketName }).promise()
							console.log(`${bucketName} deleted.`)
						})
					} catch (err) {
						console.error(
							`Failed to purge bucket ${bucketName}: ${err.message}`,
						)
					}
				}),
		)
	},
	help: 'Purges all S3 buckets (used during CI runs)',
})
