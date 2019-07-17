import * as CloudFormation from '@aws-cdk/core'
import * as Cognito from '@aws-cdk/aws-cognito'
import * as CloudFront from '@aws-cdk/aws-cloudfront'
import * as IAM from '@aws-cdk/aws-iam'
import * as S3 from '@aws-cdk/aws-s3'

export class BifravstStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		props: { mqttEndpoint: string },
	) {
		super(parent, id)

		new CloudFormation.CfnOutput(this, 'mqttEndpoint', {
			value: props.mqttEndpoint,
			exportName: `${this.stackName}:mqttEndpoint`,
		})

		const userPool = new Cognito.UserPool(this, 'userPool', {
			userPoolName: id,
			signInType: Cognito.SignInType.EMAIL,
			autoVerifiedAttributes: [Cognito.UserPoolAttribute.EMAIL],
		})
		const userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: userPool,
			enabledAuthFlows: [Cognito.AuthFlow.USER_PASSWORD],
		})
		const identityPool = new Cognito.CfnIdentityPool(this, 'identityPool', {
			identityPoolName: id,
			allowUnauthenticatedIdentities: false,
			cognitoIdentityProviders: [
				{
					clientId: userPoolClient.userPoolClientId,
					providerName: userPool.userPoolProviderName,
				},
			],
		})

		const userRole = new IAM.Role(this, 'userRole', {
			assumedBy: new IAM.FederatedPrincipal(
				'cognito-identity.amazonaws.com',
				{
					StringEquals: {
						'cognito-identity.amazonaws.com:aud': identityPool.ref,
					},
					'ForAnyValue:StringLike': {
						'cognito-identity.amazonaws.com:amr': 'authenticated',
					},
				},
				'sts:AssumeRoleWithWebIdentity',
			),
		})

		const unauthenticatedUserRole = new IAM.Role(
			this,
			'unauthenticatedUserRole',
			{
				assumedBy: new IAM.FederatedPrincipal(
					'cognito-identity.amazonaws.com',
					{
						StringEquals: {
							'cognito-identity.amazonaws.com:aud': identityPool.ref,
						},
						'ForAnyValue:StringLike': {
							'cognito-identity.amazonaws.com:amr': 'unauthenticated',
						},
					},
					'sts:AssumeRoleWithWebIdentity',
				),
			},
		)

		new Cognito.CfnIdentityPoolRoleAttachment(this, 'identityPoolRoles', {
			identityPoolId: identityPool.ref.toString(),
			roles: {
				authenticated: userRole.roleArn,
				unauthenticated: unauthenticatedUserRole.roleArn,
			},
		})

		new CloudFormation.CfnOutput(this, 'userPoolId', {
			value: userPool.userPoolId,
			exportName: `${this.stackName}:userPoolId`,
		})

		new CloudFormation.CfnOutput(this, 'identityPoolId', {
			value: identityPool.ref,
			exportName: `${this.stackName}:identityPoolId`,
		})

		new CloudFormation.CfnOutput(this, 'userPoolClientId', {
			value: userPoolClient.userPoolClientId,
			exportName: `${this.stackName}:userPoolClientId`,
		})

		const websiteBucket = new S3.Bucket(this, 'websitBucket', {
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
			websiteErrorDocument: 'error.html',
		})

		new CloudFormation.CfnOutput(this, 'websiteBucketName', {
			value: websiteBucket.bucketName,
			exportName: `${this.stackName}:websiteBucketName`,
		})

		const distribution = new CloudFront.CfnDistribution(
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
							domainName: `${websiteBucket.bucketName}.s3-website.${this.region}.amazonaws.com`,
							id: 'S3',
							customOriginConfig: {
								originProtocolPolicy: 'http-only',
							},
						},
					],
				},
			},
		)

		new CloudFormation.CfnOutput(this, 'cloudfrontDistributionId', {
			value: distribution.ref,
			exportName: `${this.stackName}:cloudFrontDistributionId`,
		})

		new CloudFormation.CfnOutput(this, 'websiteDomainName', {
			value: distribution.attrDomainName,
			exportName: `${this.stackName}:websiteDomainName`,
		})
	}
}
