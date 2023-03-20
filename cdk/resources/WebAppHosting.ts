import CloudFormation from 'aws-cdk-lib'
import CloudFront from 'aws-cdk-lib/aws-cloudfront'
import S3 from 'aws-cdk-lib/aws-s3'

/**
 * This sets up the web hosting for a web app
 */
export class WebAppHosting extends CloudFormation.Resource {
	public readonly bucket: S3.IBucket
	public readonly distribution: CloudFront.CfnDistribution

	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		this.bucket = new S3.Bucket(this, 'bucket', {
			publicReadAccess: true,
			cors: [
				{
					allowedHeaders: ['*'],
					allowedMethods: [S3.HttpMethods.GET],
					allowedOrigins: ['*'],
					exposedHeaders: ['Date'],
					maxAge: 3600,
				},
			],
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
			websiteIndexDocument: 'index.html',
			websiteErrorDocument: 'index.html',
		})

		this.distribution = new CloudFront.CfnDistribution(
			this,
			'websiteDistribution',
			{
				distributionConfig: {
					enabled: true,
					priceClass: 'PriceClass_100',
					defaultRootObject: 'index.html',
					defaultCacheBehavior: {
						allowedMethods: ['HEAD', 'GET', 'OPTIONS'],
						cachedMethods: ['HEAD', 'GET'],
						compress: true,
						forwardedValues: {
							queryString: true,
							headers: [
								'Access-Control-Request-Headers',
								'Access-Control-Request-Method',
								'Origin',
							],
						},
						smoothStreaming: false,
						targetOriginId: 'S3',
						viewerProtocolPolicy: 'redirect-to-https',
					},
					ipv6Enabled: true,
					viewerCertificate: {
						cloudFrontDefaultCertificate: true,
					},
					origins: [
						{
							domainName: `${this.bucket.bucketName}.s3-website.${parent.region}.amazonaws.com`,
							id: 'S3',
							customOriginConfig: {
								originProtocolPolicy: 'http-only',
							},
						},
					],
				},
			},
		)
	}
}
