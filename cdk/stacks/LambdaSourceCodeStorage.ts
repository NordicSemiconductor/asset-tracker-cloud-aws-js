import { App, CfnOutput, RemovalPolicy, Stack } from '@aws-cdk/core'
import { Bucket } from '@aws-cdk/aws-s3'

/**
 * This stack provides a bucket to store the source code for the lambda functions
 */
export class LambdaSourceCodeStorageStack extends Stack {
	public readonly bucket: Bucket

	public constructor(parent: App, id: string) {
		super(parent, id)
		this.bucket = new Bucket(this, 'cf-sourcecode', {
			removalPolicy: RemovalPolicy.DESTROY,
		})

		new CfnOutput(this, 'bucketName', {
			value: this.bucket.bucketName,
			exportName: `${this.stackName}:bucketName`,
		})
	}
}
