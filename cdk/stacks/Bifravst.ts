import * as CloudFormation from '@aws-cdk/core'
import {
	CustomResource,
	CustomResourceProvider,
} from '@aws-cdk/aws-cloudformation'
import * as Cognito from '@aws-cdk/aws-cognito'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as CloudFront from '@aws-cdk/aws-cloudfront'
import * as IAM from '@aws-cdk/aws-iam'
import * as S3 from '@aws-cdk/aws-s3'
import * as Iot from '@aws-cdk/aws-iot'
import { BifravstLambdas } from '../cloudformation'
import { LayeredLambdas } from '@nrfcloud/package-layered-lambdas'

export class BifravstStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		props: {
			mqttEndpoint: string
			sourceCodeBucketName: string
			baseLayerZipFileName: string
			lambdas: LayeredLambdas<BifravstLambdas>
		},
	) {
		super(parent, id)

		const sourceCodeBucket = S3.Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: props.sourceCodeBucketName,
			},
		)

		const baseLayer = new Lambda.LayerVersion(this, `${id}-layer`, {
			code: Lambda.Code.bucket(sourceCodeBucket, props.baseLayerZipFileName),
			compatibleRuntimes: [
				Lambda.Runtime.NODEJS_10_X,
				Lambda.Runtime.NODEJS_8_10,
			],
		})

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

		const iotJitpRole = new IAM.Role(this, 'iotJitpRole', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			managedPolicies: [
				{
					managedPolicyArn:
						'arn:aws:iam::aws:policy/service-role/AWSIoTThingsRegistration',
				},
				{
					managedPolicyArn:
						'arn:aws:iam::aws:policy/service-role/AWSIoTLogging',
				},
			],
		})

		new CloudFormation.CfnOutput(this, 'jitpRoleArn', {
			value: iotJitpRole.roleArn,
			exportName: `${this.stackName}:jitpRoleArn`,
		})

		const iotThingPolicy = new Iot.CfnPolicy(this, 'thingPolicy', {
			policyName: `${id}-thingPolicy`,
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['iot:Connect'],
						Resource: ['arn:aws:iot:*:*:client/${iot:ClientId}'],
						Condition: {
							Bool: {
								'iot:Connection.Thing.IsAttached': [true],
							},
						},
					},
					{
						Effect: 'Allow',
						Action: ['iot:Receive'],
						Resource: ['*'],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Subscribe'],
						Resource: [
							'arn:aws:iot:*:*:topicfilter/$aws/things/${iot:ClientId}/*',
						],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: ['arn:aws:iot:*:*:topic/$aws/things/${iot:ClientId}/*'],
					},
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'thingPolicyArn', {
			value: iotThingPolicy.attrArn,
			exportName: `${this.stackName}:thingPolicyArn`,
		})

		const ThingGroupName = `${id}Things`

		new CustomResource(this, 'ThingGroup', {
			provider: CustomResourceProvider.lambda(
				new Lambda.Function(this, `${id}-ThingGroupLambda`, {
					code: Lambda.Code.bucket(
						sourceCodeBucket,
						props.lambdas.lambdaZipFileNames.createThingGroup,
					),
					layers: [baseLayer],
					description: 'Used in CloudFormation to create a thing group',
					handler: 'index.handler',
					runtime: Lambda.Runtime.NODEJS_8_10,
					timeout: CloudFormation.Duration.seconds(15),
					initialPolicy: [
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: ['iot:createThingGroup', 'iot:attachPolicy'],
						}),
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: [
								'logs:CreateLogGroup',
								'logs:CreateLogStream',
								'logs:PutLogEvents',
							],
						}),
					],
				}),
			),
			properties: {
				ThingGroupName,
				ThingGroupProperties: {
					thingGroupDescription: 'Group created for Bifravst Things',
				},
				PolicyName: iotThingPolicy.ref,
			},
		})

		new CloudFormation.CfnOutput(this, 'thingGroupName', {
			value: ThingGroupName,
			exportName: `${this.stackName}:thingGroupName`,
		})
	}
}
