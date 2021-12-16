import { App, CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib'
import { aws_s3 as S3 } from 'aws-cdk-lib'
import { SOURCECODE_STACK_NAME } from './stackName'

/**
 * This stack provides a bucket to store the source code for the lambda functions
 */
export class LambdaSourceCodeStorageStack extends Stack {
	public readonly bucket: S3.Bucket

	public constructor(parent: App) {
		super(parent, SOURCECODE_STACK_NAME)
		this.bucket = new S3.Bucket(this, 'cf-sourcecode', {
			removalPolicy: RemovalPolicy.DESTROY,
		})

		new CfnOutput(this, 'bucketName', {
			value: this.bucket.bucketName,
			exportName: `${this.stackName}:bucketName`,
		})
	}
}
