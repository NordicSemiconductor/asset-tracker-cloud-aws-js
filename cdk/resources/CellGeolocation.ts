import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as StepFunctions from '@aws-cdk/aws-stepfunctions'
import * as StepFunctionTasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { logToCloudWatch } from './logToCloudWatch'
import { lambdaLogGroup } from './lambdaLogGroup'
import { BifravstLambdas } from '../prepare-resources'
import { StateMachineType } from '@aws-cdk/aws-stepfunctions'
import { Role } from '@aws-cdk/aws-iam'

/**
 * Provides the resources for geolocating LTE/NB-IoT network cells
 */
export class CellGeolocation extends CloudFormation.Resource {
	public readonly cacheTable: DynamoDB.Table
	public readonly deviceCellGeolocationTable: DynamoDB.Table
	public readonly stateMachine: StepFunctions.IStateMachine
	public readonly stateMachineName: string

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			sourceCodeBucket,
			baseLayer,
			lambdas,
			enableUnwiredApi,
			isTest,
		}: {
			sourceCodeBucket: S3.IBucket
			baseLayer: Lambda.ILayerVersion
			lambdas: LayeredLambdas<BifravstLambdas>
			enableUnwiredApi: boolean
			isTest: boolean
		},
	) {
		super(parent, id)

		this.cacheTable = new DynamoDB.Table(this, 'cellGeolocationCache', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'cellId',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})

		const geolocateCellFromCache = new Lambda.Function(
			this,
			'geolocateCellFromCache',
			{
				layers: [baseLayer],
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					lambdas.lambdaZipFileNames.geolocateCellFromCacheStepFunction,
				),
				description: 'Geolocate cells from cache',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						actions: ['dynamodb:GetItem'],
						resources: [this.cacheTable.tableArn],
					}),
				],
				environment: {
					CACHE_TABLE: this.cacheTable.tableName,
				},
			},
		)

		lambdaLogGroup(this, 'geolocateCellFromCache', geolocateCellFromCache)

		this.deviceCellGeolocationTable = new DynamoDB.Table(
			this,
			'deviceCellGeoLocation',
			{
				billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
				partitionKey: {
					name: 'uuid',
					type: DynamoDB.AttributeType.STRING,
				},
				sortKey: {
					name: 'timestamp',
					type: DynamoDB.AttributeType.STRING,
				},
				pointInTimeRecovery: true,
				removalPolicy: isTest
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
			},
		)

		const LOCATIONS_TABLE_CELLID_INDEX =
			'cellIdIndex-720633fc-5dec-4b39-972a-b4347188d69b'

		this.deviceCellGeolocationTable.addGlobalSecondaryIndex({
			indexName: LOCATIONS_TABLE_CELLID_INDEX,
			partitionKey: {
				name: 'cellId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.INCLUDE,
			nonKeyAttributes: ['lat', 'lng', 'accuracy'],
		})

		const geolocateCellFromDevices = new Lambda.Function(
			this,
			'geolocateCellFromDevices',
			{
				layers: [baseLayer],
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					lambdas.lambdaZipFileNames
						.geolocateCellFromDeviceLocationsStepFunction,
				),
				description: 'Geolocate cells from device locations',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						actions: ['dynamodb:Query'],
						resources: [
							this.deviceCellGeolocationTable.tableArn,
							`${this.deviceCellGeolocationTable.tableArn}/*`,
						],
					}),
				],
				environment: {
					LOCATIONS_TABLE: this.deviceCellGeolocationTable.tableName,
					LOCATIONS_TABLE_CELLID_INDEX,
				},
			},
		)

		lambdaLogGroup(this, 'geolocateCellFromDevices', geolocateCellFromDevices)

		const cacheCellGeolocation = new Lambda.Function(
			this,
			'cacheCellGeolocation',
			{
				layers: [baseLayer],
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.minutes(1),
				memorySize: 1792,
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					lambdas.lambdaZipFileNames.cacheCellGeolocationStepFunction,
				),
				description: 'Caches cell geolocations',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						actions: ['dynamodb:PutItem'],
						resources: [this.cacheTable.tableArn],
					}),
				],
				environment: {
					CACHE_TABLE: this.cacheTable.tableName,
				},
			},
		)

		lambdaLogGroup(this, 'cacheCellGeolocation', cacheCellGeolocation)

		// Optional step
		let geolocateCellFromUnwiredLabs: Lambda.IFunction | undefined = undefined
		if (enableUnwiredApi) {
			geolocateCellFromUnwiredLabs = new Lambda.Function(
				this,
				'geolocateCellFromUnwiredLabs',
				{
					layers: [baseLayer],
					handler: 'index.handler',
					runtime: Lambda.Runtime.NODEJS_12_X,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: Lambda.Code.bucket(
						sourceCodeBucket,
						lambdas.lambdaZipFileNames.geolocateCellFromUnwiredLabsStepFunction,
					),
					description: 'Resolve cell geolocation using the UnwiredLabs API',
					initialPolicy: [
						logToCloudWatch,
						new IAM.PolicyStatement({
							actions: ['ssm:GetParametersByPath'],
							resources: [
								`arn:aws:ssm:${parent.region}:${parent.account}:parameter/bifravst/cellGeoLocation/unwiredlabs`,
							],
						}),
					],
				},
			)

			lambdaLogGroup(
				this,
				'geolocateCellFromUnwiredLabs',
				geolocateCellFromUnwiredLabs,
			)
		}

		const isGeolocated = StepFunctions.Condition.booleanEquals(
			'$.cellgeo.located',
			true,
		)

		const stateMachineRole = new Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		this.stateMachineName = `${this.stack.stackName}-cellGeo`
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: this.stateMachineName,
			stateMachineType: StateMachineType.STANDARD,
			definition: new StepFunctions.Task(this, 'Resolve from cache', {
				task: new StepFunctionTasks.InvokeFunction(geolocateCellFromCache),
				resultPath: '$.cellgeo',
			}).next(
				new StepFunctions.Choice(this, 'Cache found?')
					.when(
						isGeolocated,
						new StepFunctions.Succeed(this, 'Done (already cached)'),
					)
					.otherwise(
						new StepFunctions.Task(this, 'Geolocation using Device Locations', {
							task: new StepFunctionTasks.InvokeFunction(
								geolocateCellFromDevices,
							),
							resultPath: '$.cellgeo',
						}).next(
							new StepFunctions.Choice(
								this,
								'Geolocated using Device Locations?',
							)
								.when(
									isGeolocated,
									new StepFunctions.Task(
										this,
										'Cache result from Device Locations',
										{
											task: new StepFunctionTasks.InvokeFunction(
												cacheCellGeolocation,
											),
											resultPath: '$.storedInCache',
										},
									).next(
										new StepFunctions.Succeed(
											this,
											'Done (resolved using Device Locations)',
										),
									),
								)
								.otherwise(
									(() => {
										if (!geolocateCellFromUnwiredLabs) {
											return new StepFunctions.Fail(this, 'Failed (No API)', {
												error: 'NO_API',
												cause:
													'No third party API is configured to resolve the cell geolocation',
											})
										}
										return new StepFunctions.Task(
											this,
											'Resolve using UnwiredLabs API',
											{
												task: new StepFunctionTasks.InvokeFunction(
													geolocateCellFromUnwiredLabs,
												),
												resultPath: '$.cellgeo',
											},
										).next(
											new StepFunctions.Choice(
												this,
												'Resolved from UnwiredLabs API?',
											)
												.when(
													isGeolocated,
													new StepFunctions.Task(
														this,
														'Cache result from UnwiredLabs API',
														{
															task: new StepFunctionTasks.InvokeFunction(
																cacheCellGeolocation,
															),
															resultPath: '$.storedInCache',
														},
													).next(
														new StepFunctions.Succeed(
															this,
															'Done (resolved using UnwiredLabs API)',
														),
													),
												)
												.otherwise(
													new StepFunctions.Fail(
														this,
														'Failed (no resolution)',
														{
															error: 'FAILED',
															cause:
																'The cell geolocation could not be resolved',
														},
													),
												),
										)
									})(),
								),
						),
					),
			),
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})

		const topicRuleRole = new IAM.Role(this, 'Role', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				iot: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${parent.region}:${parent.account}:topic/errors`,
							],
						}),
					],
				}),
				dynamodb: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['dynamodb:PutItem'],
							resources: [this.deviceCellGeolocationTable.tableArn],
						}),
					],
				}),
			},
		})

		new IoT.CfnTopicRule(this, 'storeCellGeolocationsFromDevices', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Stores the geolocations for cells from devices',
				ruleDisabled: false,
				sql: [
					'SELECT',
					'newuuid() as uuid,',
					'current.state.reported.roam.v.cell as cell,',
					'current.state.reported.roam.v.mccmnc as mccmnc,',
					'current.state.reported.roam.v.area as area,',
					// see cellGeolocation/cellId.ts for format of cellId
					'concat(current.state.reported.roam.v.cell,',
					'"-",',
					'current.state.reported.roam.v.mccmnc,',
					'"-",',
					'current.state.reported.roam.v.area) AS cellId,',
					'current.state.reported.gps.v.lat AS lat,',
					'current.state.reported.gps.v.lng AS lng,',
					'current.state.reported.gps.v.acc AS accuracy,',
					'concat("device:", topic(3)) as source,',
					"parse_time(\"yyyy-MM-dd'T'HH:mm:ss.S'Z'\", timestamp()) as timestamp",
					`FROM '$aws/things/+/shadow/update/documents'`,
					'WHERE',
					// only if it actually has roaming information
					'current.state.reported.roam.v.area <> NULL',
					'AND current.state.reported.roam.v.mccmnc <> NULL',
					'AND current.state.reported.roam.v.cell <> NULL',
					// and if it has GPS location
					'AND current.state.reported.gps.v.lat <> NULL',
					'AND current.state.reported.gps.v.lng <> NULL',
					// only if the location has changed
					'AND (',
					'isUndefined(previous.state.reported.gps.v.lat)',
					'OR',
					'previous.state.reported.gps.v.lat <> current.state.reported.gps.v.lat',
					'OR',
					'isUndefined(previous.state.reported.gps.v.lng)',
					'OR',
					'previous.state.reported.gps.v.lng <> current.state.reported.gps.v.lng',
					')',
				].join(' '),
				actions: [
					{
						dynamoDBv2: {
							putItem: {
								tableName: this.deviceCellGeolocationTable.tableName,
							},
							roleArn: topicRuleRole.roleArn,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: topicRuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})
	}
}
