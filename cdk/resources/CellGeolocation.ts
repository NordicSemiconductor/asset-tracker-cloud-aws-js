import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
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
import { LambdasWithLayer } from './LambdasWithLayer'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { enabledInContext } from '../helper/enabledInContext'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'

/**
 * Provides the resources for geolocating LTE/NB-IoT network cells
 */
export class CellGeolocation extends CloudFormation.Resource {
	public readonly cacheTable: DynamoDB.Table
	public readonly deviceCellGeolocationTable: DynamoDB.Table
	public readonly stateMachine: StepFunctions.IStateMachine

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
			runtime: Lambda.Runtime.NODEJS_14_X,

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
			runtime: Lambda.Runtime.NODEJS_14_X,

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
			runtime: Lambda.Runtime.NODEJS_14_X,

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
					runtime: Lambda.Runtime.NODEJS_14_X,

					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: lambdas.lambdas.geolocateCellFromUnwiredLabsStepFunction,
					description: 'Resolve cell geolocation using the Unwired Labs API',
					initialPolicy: [
						logToCloudWatch,
						new IAM.PolicyStatement({
							actions: ['ssm:GetParametersByPath'],
							resources: [
								`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/thirdParty/unwiredlabs`,
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
						runtime: Lambda.Runtime.NODEJS_14_X,

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
									`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/thirdParty/nrfconnectforcloud`,
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
			stateMachineName: `${this.stack.stackName}-cellGeo`,
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
	}
}
