import { CommandDefinition } from './CommandDefinition'
import { S3, CloudFormation } from 'aws-sdk'
import * as chalk from 'chalk'
import { retry } from './retry'
import { region } from '../../cdk/regions'
import {
	CORE_STACK_NAME,
	DEVICEUI_STACK_NAME,
	WEBAPP_STACK_NAME,
	CONTINUOUS_DEPLOYMENT_STACK_NAME,
	FIRMWARE_CI_STACK_NAME,
} from '../../cdk/stacks/stackName'
import { paginate } from '../../util/paginate'

const cf = new CloudFormation({ region })

const listBuckets = async (StackName: string) =>
	cf
		.describeStackResources({ StackName })
		.promise()
		.then(
			(res) =>
				res?.StackResources?.filter(
					({ ResourceType }) => ResourceType === 'AWS::S3::Bucket',
				).map(({ PhysicalResourceId }) => PhysicalResourceId as string) ?? [],
		)
		.catch(({ message }) => {
			console.warn(chalk.yellow.dim(message))
			return []
		})

export const purgeBucketsCommand = (): CommandDefinition => ({
	command: 'purge-buckets',
	action: async () => {
		const buckets = [
			...(await listBuckets(CORE_STACK_NAME)),
			...(await listBuckets(WEBAPP_STACK_NAME)),
			...(await listBuckets(DEVICEUI_STACK_NAME)),
			...(await listBuckets(CONTINUOUS_DEPLOYMENT_STACK_NAME)),
			...(await listBuckets(FIRMWARE_CI_STACK_NAME)),
		]
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
							await paginate({
								paginator: async (nextMarker?: string) => {
									const { Contents, Marker } = await s3
										.listObjects({ Bucket: bucketName, Marker: nextMarker })
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
									return Marker
								},
							})
							await s3.deleteBucket({ Bucket: bucketName }).promise()
							console.log(`${bucketName} deleted.`)
						})
					} catch (err) {
						console.error(
							chalk.yellow.dim(
								`Failed to purge bucket ${bucketName}: ${err.message}`,
							),
						)
					}
				}),
		)
	},
	help: 'Purges all S3 buckets (used during CI runs)',
})
