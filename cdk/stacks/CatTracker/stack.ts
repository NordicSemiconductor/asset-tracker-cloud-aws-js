import * as CloudFormation from '@aws-cdk/core'
import * as Cognito from '@aws-cdk/aws-cognito'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as IAM from '@aws-cdk/aws-iam'
import * as S3 from '@aws-cdk/aws-s3'
import * as Iot from '@aws-cdk/aws-iot'
import { RepublishDesiredConfig } from '../../resources/RepublishDesiredConfig'
import { AvatarStorage } from '../../resources/AvatarStorage'
import { FOTAStorage } from '../../resources/FOTAStorage'
import { CellGeolocation } from '../../resources/CellGeolocation'
import { CellGeolocationApi } from '../../resources/CellGeolocationApi'
import { ThingGroupLambda } from '../../resources/ThingGroupLambda'
import { ThingGroup } from '../../resources/ThingGroup'
import { CORE_STACK_NAME } from '../stackName'
import { LambdasWithLayer } from '../../resources/LambdasWithLayer'
import { lambdasOnS3 } from '../../resources/lambdasOnS3'
import { HistoricalData } from '../../resources/HistoricalData'
import { warn } from '../../helper/note'
import { NodeJS14Runtime } from '../../resources/NodeJS14Runtime'
import { PackedLambdas } from '../../helper/lambdas/PackedLambdas'
import { CatTrackerLambdas, CDKLambdas } from './lambdas'

export class CatTrackerStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		{
			sourceCodeBucketName,
			packedLambdas,
			packedCDKLambdas,
		}: {
			sourceCodeBucketName: string
			packedLambdas: PackedLambdas<CatTrackerLambdas>
			packedCDKLambdas: PackedLambdas<CDKLambdas>
		},
	) {
		super(parent, CORE_STACK_NAME)

		const sourceCodeBucket = S3.Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: sourceCodeBucketName,
			},
		)
		const lambasOnBucket = lambdasOnS3(sourceCodeBucket)

		const baseLayer = new Lambda.LayerVersion(
			this,
			`${CORE_STACK_NAME}-layer`,
			{
				code: Lambda.Code.fromBucket(
					sourceCodeBucket,
					packedLambdas.layerZipFileName,
				),
				// compatibleRuntimes: [Lambda.Runtime.NODEJS_14_X], // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
				compatibleRuntimes: [NodeJS14Runtime],
			},
		)

		const cloudFormationLayer = new Lambda.LayerVersion(
			this,
			`${CORE_STACK_NAME}-cloudformation-layer`,
			{
				code: Lambda.Code.fromBucket(
					sourceCodeBucket,
					packedCDKLambdas.layerZipFileName,
				),
				// compatibleRuntimes: [Lambda.Runtime.NODEJS_14_X], // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
				compatibleRuntimes: [NodeJS14Runtime],
			},
		)

		new CloudFormation.CfnOutput(this, 'cloudformationLayerVersionArn', {
			value: cloudFormationLayer.layerVersionArn,
			exportName: `${this.stackName}:cloudformationLayerVersionArn`,
		})

		const isTest = this.node.tryGetContext('isTest') === true

		if (isTest) {
			warn('UserPool', 'Disabling email verification.')
		}

		const userPool = new Cognito.UserPool(this, 'userPool', {
			userPoolName: CORE_STACK_NAME,
			signInAliases: {
				email: true,
			},
			autoVerify: {
				// Do not send verification emails for test accounts
				// https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-cognito-userpool.html#cfn-cognito-userpool-autoverifiedattributes means that for attributes included Cognito will start the verification automatically.
				// This is a little confusing: it DOES NOT mean that these attributes are set to "verified" automatically
				email: isTest ? false : true,
			},
			selfSignUpEnabled: true,
			passwordPolicy: {
				requireSymbols: false,
			},
			accountRecovery: Cognito.AccountRecovery.EMAIL_ONLY,
			userVerification: {
				emailBody:
					'The verification code to your new Cat Tracker account is {####}',
				emailStyle: Cognito.VerificationEmailStyle.CODE,
				emailSubject: 'Verify your new Cat Tracker account',
			},
		})

		new CloudFormation.CfnOutput(this, 'userPoolId', {
			value: userPool.userPoolId,
			exportName: `${this.stackName}:userPoolId`,
		})

		const userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool: userPool,
			authFlows: {
				userPassword: true,
				userSrp: true,
				adminUserPassword: true,
			},
		})
		const developerProviderName = 'developerAuthenticated'

		new CloudFormation.CfnOutput(this, 'developerProviderName', {
			value: developerProviderName,
			exportName: `${this.stackName}:developerProviderName`,
		})

		const identityPool = new Cognito.CfnIdentityPool(this, 'identityPool', {
			identityPoolName: CORE_STACK_NAME.replace(/-/, '_'),
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
							'arn:aws:iot:*:*:topic/${iot:ClientId}/messages',
						],
					},
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'thingPolicyArn', {
			value: iotThingPolicy.attrArn,
			exportName: `${this.stackName}:thingPolicyArn`,
		})

		const cdkLambdas = {
			lambdas: lambasOnBucket(packedCDKLambdas),
			layers: [cloudFormationLayer],
		}

		const thingGroupLambda = new ThingGroupLambda(this, 'thingGroupLambda', {
			cdkLambdas,
		})

		new CloudFormation.CfnOutput(this, 'thingGroupLambdaArn', {
			value: thingGroupLambda.function.functionArn,
			exportName: `${this.stackName}:thingGroupLambdaArn`,
		})

		new ThingGroup(this, 'deviceThingGroup', {
			name: CORE_STACK_NAME,
			description: 'Group created for nRF Asset Tracker things',
			addExisting: this.node.tryGetContext('isTest') === false,
			PolicyName: iotThingPolicy.ref,
			thingGroupLambda: thingGroupLambda.function,
		})

		new CloudFormation.CfnOutput(this, 'thingGroupName', {
			value: CORE_STACK_NAME,
			exportName: `${this.stackName}:thingGroupName`,
		})

		new RepublishDesiredConfig(this, 'republishDesiredConfig')

		const avatarStorage = new AvatarStorage(this, 'avatars', { userRole })

		new CloudFormation.CfnOutput(this, 'avatarBucketName', {
			value: avatarStorage.bucket.bucketName,
			exportName: `${this.stackName}:avatarBucketName`,
		})

		const lambdas: LambdasWithLayer<CatTrackerLambdas> = {
			lambdas: lambasOnBucket(packedLambdas),
			layers: [baseLayer],
		}

		const hd = new HistoricalData(this, 'historicalData', {
			lambdas,
			userRole,
		})

		new CloudFormation.CfnOutput(this, 'historicaldataTableInfo', {
			value: hd.table.ref,
			exportName: `${this.stackName}:historicaldataTableInfo`,
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
			lambdas,
		})

		cellgeo.stateMachine.grantStartExecution(userRole)

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['states:describeExecution'],
				resources: [
					`arn:aws:states:${this.region}:${this.account}:execution:${cellgeo.stateMachineName}:*`,
				],
			}),
		)

		const cellGeoApi = new CellGeolocationApi(this, 'cellGeolocationApi', {
			lambdas,
			cellgeo,
		})

		new CloudFormation.CfnOutput(this, 'geolocationApiUrl', {
			value: `https://${cellGeoApi.api.ref}.execute-api.${this.region}.amazonaws.com/${cellGeoApi.stage.stageName}/`,
			exportName: `${this.stackName}:geolocationApiUrl`,
		})

		new CloudFormation.CfnOutput(this, 'geolocationApiId', {
			value: cellGeoApi.api.ref,
			exportName: `${this.stackName}:geolocationApiId`,
		})
	}
}

export type StackOutputs = {
	userPoolId: string
	identityPoolId: string
	developerProviderName: string
	userPoolClientId: string
	webAppBucketName: string
	cloudfrontDistributionIdWebApp: string
	webAppDomainName: string
	deviceUiBucketName: string
	cloudfrontDistributionIdDeviceUi: string
	deviceUiBaseUrl: string
	jitpRoleArn: string
	thingPolicyArn: string
	thingGroupName: string
	userIotPolicyArn: string
	avatarBucketName: string
	fotaBucketName: string
	historicaldataTableInfo: string
	geolocationApiUrl: string
	geolocationApiId: string
}
