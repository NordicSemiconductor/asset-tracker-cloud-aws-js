import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as StepFunctions from '@aws-cdk/aws-stepfunctions'
import * as StepFunctionTasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as Lambda from '@aws-cdk/aws-lambda'
import { logToCloudWatch } from './logToCloudWatch'
import { LambdaLogGroup } from './LambdaLogGroup'
import {
	Condition,
	IChainable,
	Result,
	StateMachineType,
} from '@aws-cdk/aws-stepfunctions'
import { Role } from '@aws-cdk/aws-iam'
import * as SQS from '@aws-cdk/aws-sqs'
import { LambdasWithLayer } from './LambdasWithLayer'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { enabledInContext } from '../helper/enabledInContext'
import { NodeJS14Runtime } from './NodeJS14Runtime'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'

/**
 * Provides the resources for geolocating LTE/NB-IoT network cells
 */
export class CellGeolocation extends CloudFormation.Resource {
	public readonly cacheTable: DynamoDB.Table
	public readonly deviceCellGeolocationTable: DynamoDB.Table
	public readonly stateMachine: StepFunctions.IStateMachine
	public readonly stateMachineName: string
	public readonly resolutionJobsQueue: SQS.IQueue

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
		},
	) {
		super(parent, id)

		this.stateMachineName = `${this.stack.stackName}-cellGeo`

		this.cacheTable = new DynamoDB.Table(this, 'cellGeolocationCache', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'cellId',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy:
				this.node.tryGetContext('isTest') === true
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})

		const fromCache = new Lambda.Function(this, 'fromCache', {
			layers: lambdas.layers,
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateCellFromCacheStepFunction,
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
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromCacheLogs', fromCache)

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
				removalPolicy:
					this.node.tryGetContext('isTest') === true
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

		const fromDevices = new Lambda.Function(this, 'fromDevices', {
			layers: lambdas.layers,
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateCellFromDeviceLocationsStepFunction,
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
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromDevicesLogs', fromDevices)

		const addToCache = new Lambda.Function(this, 'addToCache', {
			layers: lambdas.layers,
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
			timeout: CloudFormation.Duration.minutes(1),
			memorySize: 1792,
			code: lambdas.lambdas.cacheCellGeolocationStepFunction,
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
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'addToCacheLogs', addToCache)

		const checkFlag = enabledInContext(this.node)

		// Optional step: resolve using Unwired Labs API
		let fromUnwiredLabs: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'unwiredlabs',
			component: 'Unwired Labs API',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromUnwiredLabs = new Lambda.Function(this, 'fromUnwiredLabs', {
					layers: lambdas.layers,
					handler: 'index.handler',
					// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
					runtime: NodeJS14Runtime,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: lambdas.lambdas.geolocateCellFromUnwiredLabsStepFunction,
					description: 'Resolve cell geolocation using the Unwired Labs API',
					initialPolicy: [
						logToCloudWatch,
						new IAM.PolicyStatement({
							actions: ['ssm:GetParametersByPath'],
							resources: [
								`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/cellGeoLocation/unwiredlabs`,
							],
						}),
					],
					environment: {
						VERSION: this.node.tryGetContext('version'),
						STACK_NAME: this.stack.stackName,
					},
				})

				new LambdaLogGroup(this, 'fromUnwiredLabsLogs', fromUnwiredLabs)
			},
		})

		// Optional step: resolve using nRF Connect for Cloud API
		let fromNrfConnectForCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfconnectforcloud',
			component: 'nRF Connect for Cloud API',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromNrfConnectForCloud = new Lambda.Function(
					this,
					'fromNrfConnectForCloud',
					{
						layers: lambdas.layers,
						handler: 'index.handler',
						// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
						runtime: NodeJS14Runtime,
						timeout: CloudFormation.Duration.seconds(10),
						memorySize: 1792,
						code: lambdas.lambdas
							.geolocateCellFromNrfConnectForCloudStepFunction,
						description:
							'Resolve cell geolocation using the nRF Connect for Cloud API',
						initialPolicy: [
							logToCloudWatch,
							new IAM.PolicyStatement({
								actions: ['ssm:GetParametersByPath'],
								resources: [
									`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/cellGeoLocation/nrfconnectforcloud`,
								],
							}),
						],
						environment: {
							VERSION: this.node.tryGetContext('version'),
							STACK_NAME: this.stack.stackName,
						},
					},
				)

				new LambdaLogGroup(
					this,
					'fromNrfConnectForCloudLogs',
					fromNrfConnectForCloud,
				)
			},
		})

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
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: this.stateMachineName,
			stateMachineType: StateMachineType.STANDARD,
			definition: new StepFunctionTasks.LambdaInvoke(
				this,
				'Resolve from cache',
				{
					lambdaFunction: fromCache,
					resultPath: '$.cellgeo',
					payloadResponseOnly: true,
				},
			).next(
				new StepFunctions.Choice(this, 'Cache found?')
					.when(
						isGeolocated,
						new StepFunctions.Succeed(this, 'Done (already cached)'),
					)
					.otherwise(
						new StepFunctionTasks.LambdaInvoke(
							this,
							'Geolocation using Device Locations',
							{
								lambdaFunction: fromDevices,
								resultPath: '$.cellgeo',
								payloadResponseOnly: true,
							},
						).next(
							new StepFunctions.Choice(
								this,
								'Geolocated using Device Locations?',
							)
								.when(
									isGeolocated,
									new StepFunctionTasks.LambdaInvoke(
										this,
										'Cache result from Device Locations',
										{
											lambdaFunction: addToCache,
											resultPath: '$.storedInCache',
											payloadResponseOnly: true,
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
										if (
											fromUnwiredLabs === undefined &&
											fromNrfConnectForCloud === undefined
										) {
											return new StepFunctions.Fail(this, 'Failed (No API)', {
												error: 'NO_API',
												cause:
													'No third party API is configured to resolve the cell geolocation',
											})
										}
										const markSource = (source: string) =>
											new StepFunctions.Pass(
												this,
												`mark source in result as ${source}`,
												{
													resultPath: '$.source',
													result: Result.fromString(source),
												},
											)
										const branches: IChainable[] = []
										if (fromUnwiredLabs !== undefined) {
											branches.push(
												new StepFunctionTasks.LambdaInvoke(
													this,
													'Resolve using Unwired Labs API',
													{
														lambdaFunction: fromUnwiredLabs,
														payloadResponseOnly: true,
													},
												).next(markSource('unwiredlabs')),
											)
										}
										if (fromNrfConnectForCloud !== undefined) {
											branches.push(
												new StepFunctionTasks.LambdaInvoke(
													this,
													'Resolve using nRF Connect for Cloud API',
													{
														lambdaFunction: fromNrfConnectForCloud,
														payloadResponseOnly: true,
													},
												).next(markSource('nrfconnectforcloud')),
											)
										}

										const cacheResult = new StepFunctionTasks.LambdaInvoke(
											this,
											'Cache result from third party API',
											{
												lambdaFunction: addToCache,
												resultPath: '$.storedInCache',
												payloadResponseOnly: true,
											},
										).next(
											new StepFunctions.Succeed(
												this,
												'Done (resolved using third party API)',
											),
										)

										const checkApiResult = (
											n: number,
										): [Condition, IChainable] => [
											StepFunctions.Condition.booleanEquals(
												`$.cellgeo[${n}].located`,
												true,
											),
											new StepFunctions.Pass(
												this,
												`yes: write location data from result ${n} to input`,
												{
													resultPath: '$.cellgeo',
													inputPath: `$.cellgeo[${n}]`,
												},
											).next(cacheResult),
										]

										return new StepFunctions.Parallel(
											this,
											'Resolve using third party API',
											{
												resultPath: '$.cellgeo',
											},
										)
											.branch(...branches)
											.next(
												new StepFunctions.Choice(
													this,
													'Resolved from any third party API?',
												)
													.when(...checkApiResult(0))
													.when(...checkApiResult(1))
													.otherwise(
														new StepFunctions.Pass(
															this,
															'no: mark cell as not located',
															{
																resultPath: '$.cellgeo',
																result: Result.fromObject({ located: false }),
															},
														).next(
															new StepFunctionTasks.LambdaInvoke(
																this,
																'Cache result (not resolved)',
																{
																	lambdaFunction: addToCache,
																	resultPath: '$.storedInCache',
																	payloadResponseOnly: true,
																},
															).next(
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

		const storeCellGeolocationsFromDevicesSQL = (nwLocation: 'dev' | 'roam') =>
			new IoT.CfnTopicRule(
				this,
				`storeCellGeolocationsFromDevices${nwLocation}`,
				{
					topicRulePayload: {
						awsIotSqlVersion: '2016-03-23',
						description: `Stores the geolocations for cells from devices (with nw in ${nwLocation})`,
						ruleDisabled: false,
						sql: [
							'SELECT',
							'newuuid() as uuid,',
							'current.state.reported.roam.v.cell as cell,',
							`current.state.reported.${nwLocation}.v.nw as nw,`,
							'current.state.reported.roam.v.mccmnc as mccmnc,',
							'current.state.reported.roam.v.area as area,',
							// see cellId in @nordicsemiconductor/cell-geolocation-helpers for format of cellId
							'concat(',
							`CASE startswith(current.state.reported.${nwLocation}.v.nw, "NB-IoT") WHEN true THEN "nbiot" ELSE "ltem" END,`,
							'"-",',
							'current.state.reported.roam.v.cell,',
							'"-",',
							'current.state.reported.roam.v.mccmnc,',
							'"-",',
							'current.state.reported.roam.v.area',
							') AS cellId,',
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
							`AND current.state.reported.${nwLocation}.v.nw <> NULL`,
							// and if it has GPS location
							'AND current.state.reported.gps.v.lat <> NULL AND current.state.reported.gps.v.lat <> 0',
							'AND current.state.reported.gps.v.lng <> NULL AND current.state.reported.gps.v.lng <> 0',
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
				},
			)

		storeCellGeolocationsFromDevicesSQL('roam')
		// FIXME: remove fallback for current firmware revision, which has nw in dev, not in roam
		storeCellGeolocationsFromDevicesSQL('dev')

		this.resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${`${id}-${this.stack.stackName}`.substr(0, 75)}.fifo`,
		})

		const fromSQS = new Lambda.Function(this, 'fromSQS', {
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.invokeStepFunctionFromSQS,
			description:
				'Invoke the cell geolocation resolution step function for SQS messages',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: [
						'sqs:ReceiveMessage',
						'sqs:DeleteMessage',
						'sqs:GetQueueAttributes',
					],
					resources: [this.resolutionJobsQueue.queueArn],
				}),
			],
			environment: {
				STEP_FUNCTION_ARN: this.stateMachine.stateMachineArn,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromSQSLogs', fromSQS)

		fromSQS.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: this.resolutionJobsQueue.queueArn,
		})

		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: this.resolutionJobsQueue.queueArn,
			target: fromSQS,
			batchSize: 10,
		})

		this.stateMachine.grantStartExecution(fromSQS)
	}
}
