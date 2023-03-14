import {
	CloudFormationClient,
	DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation'
import {
	DeleteBucketCommand,
	DeleteObjectCommand,
	ListObjectsCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import chalk from 'chalk'
import {
	CONTINUOUS_DEPLOYMENT_STACK_NAME,
	CORE_STACK_NAME,
	FIRMWARE_CI_STACK_NAME,
	WEBAPP_STACK_NAME,
} from '../../cdk/stacks/stackName'
import { paginate } from '../../util/paginate'
import { CommandDefinition } from './CommandDefinition'
import { retry } from './retry'

const cf = new CloudFormationClient({})

const listBuckets = async (StackName: string) =>
	cf
		.send(new DescribeStackResourcesCommand({ StackName }))

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
			...(await listBuckets(CONTINUOUS_DEPLOYMENT_STACK_NAME)),
			...(await listBuckets(FIRMWARE_CI_STACK_NAME)),
		]
		const s3 = new S3Client({})
		await Promise.all(
			buckets
				.filter((b) => b)
				.map(async (bucketName) => {
					console.log(
						chalk.magenta.dim('Purging bucket'),
						chalk.blue.dim(bucketName),
					)
					try {
						await retry(
							3,
							() => 5000,
						)(async () => {
							await paginate({
								paginator: async (nextMarker?: string) => {
									const { Contents, Marker } = await s3.send(
										new ListObjectsCommand({
											Bucket: bucketName,
											Marker: nextMarker,
										}),
									)

									if (!Contents) {
										console.log(chalk.green.dim(`${bucketName} is empty.`))
									} else {
										await Promise.all(
											Contents.map(async (obj) => {
												console.log(
													chalk.magenta.dim(bucketName),
													chalk.blue.dim(obj.Key),
												)
												return s3.send(
													new DeleteObjectCommand({
														Bucket: bucketName,
														Key: `${obj.Key}`,
													}),
												)
											}),
										)
									}
									return Marker
								},
							})
							await s3.send(new DeleteBucketCommand({ Bucket: bucketName }))
							console.log(chalk.green(`${bucketName} deleted.`))
						})
					} catch (err) {
						console.error(
							chalk.yellow.dim(
								`Failed to purge bucket ${bucketName}: ${
									(err as Error).message
								}`,
							),
						)
					}
				}),
		)
	},
	help: 'Purges all S3 buckets (used during CI runs)',
})
