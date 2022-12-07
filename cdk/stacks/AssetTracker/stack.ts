import * as CloudFormation from 'aws-cdk-lib'
import * as Cognito from 'aws-cdk-lib/aws-cognito'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Iot from 'aws-cdk-lib/aws-iot'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as S3 from 'aws-cdk-lib/aws-s3'
import { PackedLambdas } from '../../helper/lambdas/PackedLambdas'
import { warn } from '../../helper/note'
import { AGPSDeviceRequestHandler } from '../../resources/AGPSDeviceRequestHandler'
import { AGPSResolver } from '../../resources/AGPSResolver'
import { AGPSStorage } from '../../resources/AGPSStorage'
import { CellGeolocation } from '../../resources/CellGeolocation'
import { CellGeolocationApi } from '../../resources/CellGeolocationApi'
import { DeviceCellGeolocations } from '../../resources/DeviceCellGeolocations'
import { FOTAStorage } from '../../resources/FOTAStorage'
import { HistoricalData } from '../../resources/HistoricalData'
import { lambdasOnS3 } from '../../resources/lambdasOnS3'
import { LambdasWithLayer } from '../../resources/LambdasWithLayer'
import { NeighborCellGeolocation } from '../../resources/NeighborCellGeolocation'
import { NeighborCellGeolocationApi } from '../../resources/NeighborCellGeolocationApi'
import { NeighborCellMeasurementsStorage } from '../../resources/NeighborCellMeasurementsStorage'
import { PGPSDeviceRequestHandler } from '../../resources/PGPSDeviceRequestHandler'
import { PGPSResolver } from '../../resources/PGPSResolver'
import { PGPSStorage } from '../../resources/PGPSStorage'
import { RepublishDesiredConfig } from '../../resources/RepublishDesiredConfig'
import { ThingGroup } from '../../resources/ThingGroup'
import { ThingGroupLambda } from '../../resources/ThingGroupLambda'
import { CORE_STACK_NAME } from '../stackName'
import { AssetTrackerLambdas, CDKLambdas } from './lambdas'

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
	neighborCellGeolocationApiUrl: `${CORE_STACK_NAME}:neighborCellGeolocationApiUrl`,
	neighborCellGeolocationApiId: `${CORE_STACK_NAME}:neighborCellGeolocationApiId`,
	ncellmeasStorageTableName: `${CORE_STACK_NAME}:ncellmeasStorageTableName`,
	ncellmeasStorageTableArn: `${CORE_STACK_NAME}:ncellmeasStorageTableArn`,
	cloudformationLayerVersionArn: `${CORE_STACK_NAME}:cloudformationLayerVersionArn`,
} as const

export class AssetTrackerStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		{
			sourceCodeBucketName,
			packedLambdas,
			packedCDKLambdas,
		}: {
			sourceCodeBucketName: string
			packedLambdas: PackedLambdas<AssetTrackerLambdas>
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
				compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
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
				compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
			},
		)

		new CloudFormation.CfnOutput(this, 'cloudformationLayerVersionArn', {
			value: cloudFormationLayer.layerVersionArn,
			exportName: StackOutputs.cloudformationLayerVersionArn,
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

		const cdkLambdas = {
			lambdas: lambasOnBucket(packedCDKLambdas),
			layers: [cloudFormationLayer],
		}

		const thingGroupLambda = new ThingGroupLambda(this, 'thingGroupLambda', {
			cdkLambdas,
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

		const lambdas: LambdasWithLayer<AssetTrackerLambdas> = {
			lambdas: lambasOnBucket(packedLambdas),
			layers: [baseLayer],
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

		const deviceCellGeo = new DeviceCellGeolocations(
			this,
			'deviceCellGeolocation',
		)

		const cellgeo = new CellGeolocation(this, 'cellGeolocation', {
			lambdas,
			deviceCellGeo,
		})

		new CloudFormation.CfnOutput(this, 'cellGeolocationCacheTableName', {
			value: cellgeo.cacheTable.tableName,
			exportName: StackOutputs.cellGeolocationCacheTableName,
		})

		new CloudFormation.CfnOutput(this, 'cellGeolocationCacheTableArn', {
			value: cellgeo.cacheTable.tableArn,
			exportName: StackOutputs.cellGeolocationCacheTableArn,
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

		// Neighbor Cell Measurements

		const ncellmeasStorage = new NeighborCellMeasurementsStorage(
			this,
			'ncellmeasStorage',
		)
		new CloudFormation.CfnOutput(this, 'ncellmeasStorageTableName', {
			value: ncellmeasStorage.reportsTable.tableName,
			exportName: StackOutputs.ncellmeasStorageTableName,
		})
		new CloudFormation.CfnOutput(this, 'ncellmeasStorageTableArn', {
			value: ncellmeasStorage.reportsTable.tableArn,
			exportName: StackOutputs.ncellmeasStorageTableArn,
		})
		ncellmeasStorage.reportsTable.grantReadData(userRole)

		const ncellmeasGeolocation = new NeighborCellGeolocation(
			this,
			'neighborCellGeolocation',
			{
				lambdas,
				storage: ncellmeasStorage,
			},
		)

		const neighborCellGeolocationApi = new NeighborCellGeolocationApi(
			this,
			'neighborCellGeolocationApi',
			{
				geolocation: ncellmeasGeolocation,
				lambdas,
				storage: ncellmeasStorage,
			},
		)

		new CloudFormation.CfnOutput(this, 'neighborCellGeolocationApiUrl', {
			value: `https://${neighborCellGeolocationApi.api.ref}.execute-api.${this.region}.amazonaws.com/${neighborCellGeolocationApi.stage.stageName}/`,
			exportName: StackOutputs.neighborCellGeolocationApiUrl,
		})

		new CloudFormation.CfnOutput(this, 'neighborCellGeolocationApiId', {
			value: neighborCellGeolocationApi.api.ref,
			exportName: StackOutputs.neighborCellGeolocationApiId,
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
	}
}
