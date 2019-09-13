import { ComandDefinition } from '../CommandDefinition'
import { stackOutput } from '../../cloudformation/stackOutput'
import { stackId as sourcecodeStackId } from '../../../cdk/stacks/LambdaSourceCodeStorage'
import { S3 } from 'aws-sdk'

export const purgeBucketsCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): ComandDefinition => ({
	command: 'purge-buckets',
	action: async () => {
		const {
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
			bucketName,
		} = {
			...(await stackOutput({
				stackId,
				region,
			})),
			...(await stackOutput({
				stackId: sourcecodeStackId({
					bifravstStackName: stackId,
				}),
				region,
			})),
		} as { [key: string]: string }
		const buckets = [
			historicalDataQueryResultsBucketName,
			avatarBucketName,
			historicalDataBucketName,
			webAppBucketName,
			deviceUiBucketName,
			bucketName,
		]
		const s3 = new S3({ region })
		await Promise.all(
			buckets.map(async bucketName => {
				console.log('Purging bucket', bucketName)
				const { Contents } = await s3
					.listObjects({ Bucket: bucketName })
					.promise()
				if (!Contents) {
					console.log(`${bucketName} is empty.`)
					return
				}
				return Promise.all(
					Contents.map(async obj => {
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
