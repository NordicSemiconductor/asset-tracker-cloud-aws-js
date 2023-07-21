import CloudFormation from 'aws-cdk-lib'
import Cognito from 'aws-cdk-lib/aws-cognito'
import IAM from 'aws-cdk-lib/aws-iam'
import Iot from 'aws-cdk-lib/aws-iot'
import Lambda from 'aws-cdk-lib/aws-lambda'
import { warn } from '../../helper/note.js'
import { AGPSDeviceRequestHandler } from '../../resources/AGPSDeviceRequestHandler.js'
import { AGPSResolver } from '../../resources/AGPSResolver.js'
import { AGPSStorage } from '../../resources/AGPSStorage.js'
import { CellGeolocation } from '../../resources/CellGeolocation.js'
import { CellGeolocationApi } from '../../resources/CellGeolocationApi.js'
import { FOTAStorage } from '../../resources/FOTAStorage.js'
import { HistoricalData } from '../../resources/HistoricalData.js'
import type { LambdasWithLayer } from '../../resources/LambdasWithLayer.js'
import { NetworkSurveyGeolocation } from '../../resources/NetworkSurveyGeolocation.js'
import { NetworkSurveyGeolocationApi } from '../../resources/NetworkSurveyGeolocationApi.js'
import { NetworkSurveysStorage } from '../../resources/NetworkSurveysStorage.js'
import { PGPSDeviceRequestHandler } from '../../resources/PGPSDeviceRequestHandler.js'
import { PGPSResolver } from '../../resources/PGPSResolver.js'
import { PGPSStorage } from '../../resources/PGPSStorage.js'
import { RepublishDesiredConfig } from '../../resources/RepublishDesiredConfig.js'
import { ThingGroup } from '../../resources/ThingGroup.js'
import { ThingGroupLambda } from '../../resources/ThingGroupLambda.js'
import { CORE_STACK_NAME } from '../stackName.js'
import type { AssetTrackerLambdas, CDKLambdas } from './lambdas.js'

/**
 * Defines the names use for stack outputs, which are used below to ensure
 * that the names of output variables are correct across stacks.
 */
export const StackOutputs = {
	userPoolId: `${CORE_STACK_NAME}:userPoolId`,
	identityPoolId: `${CORE_STACK_NAME}:identityPoolId`,
	developerProviderName: `${CORE_STACK_NAME}:developerProviderName`,
	userPoolClientId: `${CORE_STACK_NAME}:userPoolClientId`,
	userPoolArn: `${CORE_STACK_NAME}:userPoolArn`,
	jitpRoleArn: `${CORE_STACK_NAME}:jitpRoleArn`,
	thingPolicyArn: `${CORE_STACK_NAME}:thingPolicyArn`,
	thingGroupName: `${CORE_STACK_NAME}:thingGroupName`,
	thingGroupLambdaArn: `${CORE_STACK_NAME}:thingGroupLambdaArn`,
	userIotPolicyName: `${CORE_STACK_NAME}:userIotPolicyName`,
	fotaBucketName: `${CORE_STACK_NAME}:fotaBucketName`,
	historicaldataTableInfo: `${CORE_STACK_NAME}:historicaldataTableInfo`,
	historicaldataTableArn: `${CORE_STACK_NAME}:historicaldataTableArn`,
	geolocationApiUrl: `${CORE_STACK_NAME}:geolocationApiUrl`,
	geolocationApiId: `${CORE_STACK_NAME}:geolocationApiId`,
	cellGeolocationCacheTableName: `${CORE_STACK_NAME}:cellGeolocationCacheTableName`,
	cellGeolocationCacheTableArn: `${CORE_STACK_NAME}:cellGeolocationCacheTableArn`,
	cellGeolocationCacheTableStreamArn: `${CORE_STACK_NAME}:cellGeolocationCacheTableStreamArn`,
	networkSurveyStorageTableName: `${CORE_STACK_NAME}:networkSurveyStorageTableName`,
	networkSurveyStorageTableArn: `${CORE_STACK_NAME}:networkSurveyStorageTableArn`,
	networkSurveyStorageTableStreamArn: `${CORE_STACK_NAME}:networkSurveyStorageTableStreamArn`,
	networkSurveyGeolocationApiUrl: `${CORE_STACK_NAME}:networkSurveyGeolocationApiUrl`,
}

export class AssetTrackerStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		{
			packedLambdas,
			packedCDKLambdas,
		}: {
			packedLambdas: AssetTrackerLambdas
			packedCDKLambdas: CDKLambdas
		},
	) {
		super(parent, CORE_STACK_NAME)

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
					'The verification code to your new nRF Asset Tracker account is {####}',
				emailStyle: Cognito.VerificationEmailStyle.CODE,
				emailSubject: 'Verify your new nRF Asset Tracker account',
			},
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
		})

		new CloudFormation.CfnOutput(this, 'userPoolId', {
			value: userPool.userPoolId,
			exportName: StackOutputs.userPoolId,
		})

		const userPoolClient = new Cognito.UserPoolClient(this, 'userPoolClient', {
			userPool,
			authFlows: {
				userPassword: true,
				userSrp: true,
				adminUserPassword: true,
			},
		})
		const developerProviderName = 'developerAuthenticated'

		new CloudFormation.CfnOutput(this, 'developerProviderName', {
			value: developerProviderName,
			exportName: StackOutputs.developerProviderName,
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
							actions: ['iot:AttachPolicy', 'iot:ListAttachedPolicies'],
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
								'iot:DetachPolicy',
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
			exportName: StackOutputs.identityPoolId,
		})

		new CloudFormation.CfnOutput(this, 'userPoolClientId', {
			value: userPoolClient.userPoolClientId,
			exportName: StackOutputs.userPoolClientId,
		})

		new CloudFormation.CfnOutput(this, 'userPoolArn', {
			value: userPool.userPoolArn,
			exportName: StackOutputs.userPoolArn,
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

		new CloudFormation.CfnOutput(this, 'userIotPolicyName', {
			value: userIotPolicy.ref,
			exportName: StackOutputs.userIotPolicyName,
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
			exportName: StackOutputs.jitpRoleArn,
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
							'arn:aws:iot:*:*:topicfilter/${iot:ClientId}/*',
						],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: [
							'arn:aws:iot:*:*:topic/$aws/things/${iot:ClientId}/*',
							'arn:aws:iot:*:*:topic/${iot:ClientId}/*',
						],
					},
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'thingPolicyArn', {
			value: iotThingPolicy.attrArn,
			exportName: StackOutputs.thingPolicyArn,
		})

		const thingGroupLambda = new ThingGroupLambda(this, 'thingGroupLambda', {
			cdkLambdas: {
				lambdas: packedCDKLambdas.lambdas,
				layers: [
					new Lambda.LayerVersion(
						this,
						`${CORE_STACK_NAME}-cloudformation-layer`,
						{
							code: Lambda.Code.fromAsset(packedCDKLambdas.layerZipFileName),
							compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
						},
					),
				],
			},
		})

		new CloudFormation.CfnOutput(this, 'thingGroupLambdaArn', {
			value: thingGroupLambda.function.functionArn,
			exportName: StackOutputs.thingGroupLambdaArn,
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
			exportName: StackOutputs.thingGroupName,
		})

		new RepublishDesiredConfig(this, 'republishDesiredConfig')

		const lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']> = {
			lambdas: packedLambdas.lambdas,
			layers: [
				new Lambda.LayerVersion(this, `${CORE_STACK_NAME}-layer`, {
					code: Lambda.Code.fromAsset(packedLambdas.layerZipFileName),
					compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
				}),
			],
		}

		const hd = new HistoricalData(this, 'historicalData', {
			lambdas,
			userRole,
		})

		new CloudFormation.CfnOutput(this, 'historicaldataTableInfo', {
			value: hd.table.ref,
			exportName: StackOutputs.historicaldataTableInfo,
		})

		new CloudFormation.CfnOutput(this, 'historicaldataTableArn', {
			value: hd.table.attrArn,
			exportName: StackOutputs.historicaldataTableArn,
		})

		// FOTA
		const fotaBucket = new FOTAStorage(this, 'Storage', { userRole })

		new CloudFormation.CfnOutput(this, 'fotaBucketName', {
			value: fotaBucket.bucket.bucketName,
			exportName: StackOutputs.fotaBucketName,
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

		new CloudFormation.CfnOutput(this, 'cellGeolocationCacheTableName', {
			value: cellgeo.cacheTable.tableName,
			exportName: StackOutputs.cellGeolocationCacheTableName,
		})
		new CloudFormation.CfnOutput(this, 'cellGeolocationCacheTableArn', {
			value: cellgeo.cacheTable.tableArn,
			exportName: StackOutputs.cellGeolocationCacheTableArn,
		})
		new CloudFormation.CfnOutput(this, 'cellGeolocationCacheTableStreamArn', {
			value: cellgeo.cacheTable.tableStreamArn as string,
			exportName: StackOutputs.cellGeolocationCacheTableStreamArn,
		})

		const cellGeoApi = new CellGeolocationApi(this, 'cellGeolocationApi', {
			lambdas,
			cellgeo,
		})

		new CloudFormation.CfnOutput(this, 'geolocationApiUrl', {
			value: `https://${cellGeoApi.api.ref}.execute-api.${this.region}.amazonaws.com/${cellGeoApi.stage.stageName}/`,
			exportName: StackOutputs.geolocationApiUrl,
		})

		new CloudFormation.CfnOutput(this, 'geolocationApiId', {
			value: cellGeoApi.api.ref,
			exportName: StackOutputs.geolocationApiId,
		})

		// A-GPS support
		const agpsStorage = new AGPSStorage(this, 'agpsStorage')
		const agpsResolver = new AGPSResolver(this, 'agpsResolver', {
			storage: agpsStorage,
			lambdas,
		})
		new AGPSDeviceRequestHandler(this, 'agpsDeviceRequestHandler', {
			lambdas,
			storage: agpsStorage,
			resolver: agpsResolver,
		})

		// P-GPS support
		const pgpsStorage = new PGPSStorage(this, 'pgpsStorage')
		const pgpsResolver = new PGPSResolver(this, 'pgpsResolver', {
			storage: pgpsStorage,
			lambdas,
		})
		new PGPSDeviceRequestHandler(this, 'pgpsDeviceRequestHandler', {
			lambdas,
			storage: pgpsStorage,
			resolver: pgpsResolver,
		})

		// Network Surveys Storage
		const networkSurveysStorage = new NetworkSurveysStorage(
			this,
			'networkSurveyStorage',
		)
		new CloudFormation.CfnOutput(this, 'networkSurveyStorageTableName', {
			value: networkSurveysStorage.surveysTable.tableName,
			exportName: StackOutputs.networkSurveyStorageTableName,
		})
		new CloudFormation.CfnOutput(this, 'networkSurveyStorageTableArn', {
			value: networkSurveysStorage.surveysTable.tableArn,
			exportName: StackOutputs.networkSurveyStorageTableArn,
		})
		new CloudFormation.CfnOutput(this, 'networkSurveyStorageTableStreamArn', {
			value: networkSurveysStorage.surveysTable.tableStreamArn as string,
			exportName: StackOutputs.networkSurveyStorageTableStreamArn,
		})
		networkSurveysStorage.surveysTable.grantReadData(userRole)

		const networkSurveyGeolocation = new NetworkSurveyGeolocation(
			this,
			'networkSurveyGeolocation',
			{
				lambdas,
				storage: networkSurveysStorage,
			},
		)

		const networkSurveysGeolocationApi = new NetworkSurveyGeolocationApi(
			this,
			'networkSurveysGeolocationApi',
			{
				lambdas,
				storage: networkSurveysStorage,
				geolocation: networkSurveyGeolocation,
			},
		)

		new CloudFormation.CfnOutput(this, 'networkSurveyGeolocationApiUrl', {
			value: networkSurveysGeolocationApi.url,
			exportName: StackOutputs.networkSurveyGeolocationApiUrl,
		})
	}
}
