import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import S3 from 'aws-cdk-lib/aws-s3'

/**
 * Storage firmware files
 */
export class FOTAStorage extends CloudFormation.Resource {
	public readonly bucket: S3.IBucket
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{ userRole }: { userRole: IAM.Role },
	) {
		super(parent, id)

		this.bucket = new S3.Bucket(this, 'bucket', {
			publicReadAccess: true,
			cors: [
				{
					allowedHeaders: ['*'],
					allowedMethods: [
						S3.HttpMethods.GET,
						S3.HttpMethods.PUT,
						S3.HttpMethods.DELETE,
					],
					allowedOrigins: ['*'],
					exposedHeaders: ['Date'],
					maxAge: 3600,
				},
			],
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: [`${this.bucket.bucketArn}/*`, this.bucket.bucketArn],
				actions: [
					's3:ListBucket',
					's3:PutObject',
					's3:GetObject',
					's3:DeleteObject',
				],
			}),
		)
	}
}
