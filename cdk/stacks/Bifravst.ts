import * as CloudFormation from '@aws-cdk/core'
import {
	CustomResource,
	CustomResourceProvider,
} from '@aws-cdk/aws-cloudformation'
import * as Cognito from '@aws-cdk/aws-cognito'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as IAM from '@aws-cdk/aws-iam'
import * as S3 from '@aws-cdk/aws-s3'
import * as Iot from '@aws-cdk/aws-iot'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { RepublishDesiredConfig } from '../resources/RepublishDesiredConfig'
import { AvatarStorage } from '../resources/AvatarStorage'
import { HistoricalData } from '../resources/HistoricalData'
import { logToCloudWatch } from '../resources/logToCloudWatch'
import { BifravstLambdas } from '../prepare-resources'
import { FOTAStorage } from '../resources/FOTAStorage'
import { CellGeolocation } from '../resources/CellGeolocation'
import { CellGeolocationApi } from '../resources/CellGeolocationApi'

export class BifravstStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{
			mqttEndpoint,
			sourceCodeBucketName,
			baseLayerZipFileName,
			lambdas,
			isTest,
			enableUnwiredApi,
		}: {
			mqttEndpoint: string
			sourceCodeBucketName: string
			baseLayerZipFileName: string
			lambdas: LayeredLambdas<BifravstLambdas>
			isTest: boolean
			enableUnwiredApi: boolean
		},
	) {
		super(parent, id)

		const sourceCodeBucket = S3.Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: sourceCodeBucketName,
			},
		)

		const baseLayer = new Lambda.LayerVersion(this, `${id}-layer`, {
			code: Lambda.Code.bucket(sourceCodeBucket, baseLayerZipFileName),
			compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
		})

		new CloudFormation.CfnOutput(this, 'mqttEndpoint', {
			value: mqttEndpoint,
			exportName: `${this.stackName}:mqttEndpoint`,
		})

		const userPool = new Cognito.UserPool(this, 'userPool', {
			userPoolName: id,
			signInType: Cognito.SignInType.EMAIL,
			autoVerifiedAttributes: [Cognito.UserPoolAttribute.EMAIL],
		})
		const userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: userPool,
			enabledAuthFlows: [
				Cognito.AuthFlow.USER_PASSWORD,
				Cognito.AuthFlow.ADMIN_NO_SRP,
			],
		})
		const developerProviderName = 'developerAuthenticated'

		new CloudFormation.CfnOutput(this, 'developerProviderName', {
			value: developerProviderName,
			exportName: `${this.stackName}:developerProviderName`,
		})

		const identityPool = new Cognito.CfnIdentityPool(this, 'identityPool', {
			identityPoolName: id.replace(/-/, '_'),
			allowUnauthenticatedIdentities: false,
			cognitoIdentityProviders: [
				{
					clientId: userPoolClient.userPoolClientId,
					providerName: userPool.userPoolProviderName,
				},
			],
			developerProviderName,
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
			inlinePolicies: {
				manageThings: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: [
								'iot:listThings',
								'iot:describeThing',
								'iot:updateThing',
							],
						}),
					],
				}),
				// This allows users to attach IoT policies to them-selves.
				// They will attach the userIotPolicy (see below) so they can connect
				// to the AWS IoT broker via MQTT.
				attachPolicy: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: [
								'iot:attachPrincipalPolicy',
								'iot:listPrincipalPolicies',
							],
						}),
					],
				}),
				iot: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: [
								'iot:Receive',
								'iot:UpdateThingShadow',
								'iot:GetThingShadow',
								'iot:Subscribe',
								'iot:Publish',
							],
							resources: ['*'],
						}),
						new IAM.PolicyStatement({
							actions: ['iot:Connect'],
							resources: ['arn:aws:iot:*:*:client/user-*'],
						}),
					],
				}),
				deleteThing: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: [
								'iot:ListThingPrincipals',
								'iot:DetachPrincipalPolicy',
								'iot:DetachThingPrincipal',
								'iot:updateCertificate',
								'iot:deleteCertificate',
								'iot:deleteThing',
							],
							resources: ['*'],
						}),
					],
				}),
			},
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

		// IoT Policy for Cognito user

		const userIotPolicy = new Iot.CfnPolicy(this, 'userIotPolicy', {
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['iot:Connect'],
						Resource: ['arn:aws:iot:*:*:client/user-*'],
					},
					{
						Effect: 'Allow',
						Action: [
							'iot:Receive',
							'iot:UpdateThingShadow',
							'iot:GetThingShadow',
						],
						Resource: ['*'],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Subscribe'],
						Resource: ['*'],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: ['*'],
					},
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'userIotPolicyArn', {
			value: userIotPolicy.attrArn,
			exportName: `${this.stackName}:userIotPolicyArn`,
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
						Resource: [
							'arn:aws:iot:*:*:topic/$aws/things/${iot:ClientId}/*',
							'arn:aws:iot:*:*:topic/${iot:ClientId}/batch',
						],
					},
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'thingPolicyArn', {
			value: iotThingPolicy.attrArn,
			exportName: `${this.stackName}:thingPolicyArn`,
		})

		const ThingGroupName = id

		const createThingGroup = new Lambda.Function(this, 'createThingGroup', {
			code: Lambda.Code.bucket(
				sourceCodeBucket,
				lambdas.lambdaZipFileNames.createThingGroup,
			),
			layers: [baseLayer],
			description:
				'Used in CloudFormation to create the thing group for the devices',
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
			timeout: CloudFormation.Duration.minutes(1),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['iot:*'],
				}),
				logToCloudWatch,
			],
		})

		new CustomResource(this, 'ThingGroupResource', {
			provider: CustomResourceProvider.lambda(createThingGroup),
			properties: {
				ThingGroupName,
				ThingGroupProperties: {
					thingGroupDescription: 'Group created for Bifravst Things',
				},
				PolicyName: iotThingPolicy.ref,
				AddExisitingThingsToGroup: isTest ? 0 : 1,
			},
		})

		new CloudFormation.CfnOutput(this, 'thingGroupName', {
			value: ThingGroupName,
			exportName: `${this.stackName}:thingGroupName`,
		})

		new RepublishDesiredConfig(this, 'republishDesiredConfig')

		const avatarStorage = new AvatarStorage(this, 'avatars', { userRole })

		new CloudFormation.CfnOutput(this, 'avatarBucketName', {
			value: avatarStorage.bucket.bucketName,
			exportName: `${this.stackName}:avatarBucketName`,
		})

		const hd = new HistoricalData(this, 'historicalData', {
			baseLayer,
			lambdas: lambdas,
			sourceCodeBucket,
			userRole,
			isTest: isTest,
		})

		new CloudFormation.CfnOutput(this, 'historicalDataBucketName', {
			value: hd.dataBucket.bucketName,
			exportName: `${this.stackName}:historicalDataBucketName`,
		})

		new CloudFormation.CfnOutput(this, 'historicalDataQueryResultsBucketName', {
			value: hd.queryResultsBucket.bucketName,
			exportName: `${this.stackName}:historicalDataQueryResultsBucketName`,
		})

		// FOTA
		const fotaBucket = new FOTAStorage(this, 'Storage', { userRole })

		new CloudFormation.CfnOutput(this, 'fotaBucketName', {
			value: fotaBucket.bucket.bucketName,
			exportName: `${this.stackName}:fotaBucketName`,
		})

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: [`arn:aws:iot:${this.region}:${this.account}:job/*`],
				actions: ['iot:*'],
			}),
		)

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: [
					'iot:ListJobs',
					'iot:CreateJob',
					'iot:ListJobExecutionsForThing',
					'iot:CancelJobExecution',
					'iot:DeleteJobExecution',
				],
			}),
		)

		// Cell Geolocation

		const cellgeo = new CellGeolocation(this, 'cellGeolocation', {
			baseLayer,
			lambdas: lambdas,
			sourceCodeBucket,
			enableUnwiredApi,
			isTest,
		})

		new CloudFormation.CfnOutput(this, 'cellGeoLocationsCacheTable', {
			value: cellgeo.cacheTable.tableName,
			exportName: `${this.stackName}:cellGeoLocationsCacheTable`,
		})

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['dynamodb:GetItem'],
				resources: [cellgeo.cacheTable.tableArn],
			}),
		)

		const cellGeoApi = new CellGeolocationApi(this, 'cellGeolocationApi', {
			baseLayer,
			lambdas: lambdas,
			sourceCodeBucket,
			cellGeolocationCacheTable: cellgeo.cacheTable,
			deviceCellGeolocationTable: cellgeo.deviceCellGeolocationTable
		})

		new CloudFormation.CfnOutput(this, 'geolocationApiUrl', {
			value: `https://${cellGeoApi.api.ref}.execute-api.${this.region}.amazonaws.com/${cellGeoApi.stage.stageName}/`,
			exportName: `${this.stackName}:geolocationApiUrl`,
		})
	}
}

export type StackOutputs = {
	mqttEndpoint: string
	userPoolId: string
	identityPoolId: string
	developerProviderName: string
	userPoolClientId: string
	webAppBucketName: string
	cloudfrontDistributionIdWebApp: string
	webAppDomainName: string
	deviceUiBucketName: string
	cloudfrontDistributionIdDeviceUi: string
	deviceUiDomainName: string
	jitpRoleArn: string
	thingPolicyArn: string
	thingGroupName: string
	userIotPolicyArn: string
	avatarBucketName: string
	fotaBucketName: string
	historicalDataBucketName: string
	historicalDataQueryResultsBucketName: string
	cellGeoLocationsCacheTable: string
	geolocationApiUrl: string
}
