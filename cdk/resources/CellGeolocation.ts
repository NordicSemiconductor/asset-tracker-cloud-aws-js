import * as CloudFormation from 'aws-cdk-lib'
import * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as StepFunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { enabledInContext } from '../helper/enabledInContext'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { DeviceCellGeolocations } from './DeviceCellGeolocations'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { logToCloudWatch } from './logToCloudWatch'

/**
 * Describes the step functions which resolves the geolocation of LTE/NB-IoT network cells using third-party location providers
 */
export class CellGeolocation extends CloudFormation.Resource {
	public readonly cacheTable: DynamoDB.Table
	public readonly stateMachine: StepFunctions.IStateMachine

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			deviceCellGeo,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			deviceCellGeo: DeviceCellGeolocations
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
			stream: DynamoDB.StreamViewType.NEW_IMAGE,
		})

		const fromCache = new Lambda.Function(this, 'fromCache', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateFromCacheStepFunction,
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

		const fromDevices = new Lambda.Function(this, 'fromDevices', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateCellFromDeviceLocationsStepFunction,
			description: 'Geolocate cells from device locations',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:Query'],
					resources: [
						deviceCellGeo.deviceCellGeolocationTable.tableArn,
						`${deviceCellGeo.deviceCellGeolocationTable.tableArn}/*`,
					],
				}),
			],
			environment: {
				LOCATIONS_TABLE: deviceCellGeo.deviceCellGeolocationTable.tableName,
				LOCATIONS_TABLE_CELLID_INDEX:
					deviceCellGeo.deviceCellGeolocationTableCellIdIndex,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromDevicesLogs', fromDevices)

		const addToCache = new Lambda.Function(this, 'addToCache', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
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
					architecture: Lambda.Architecture.ARM_64,
					runtime: Lambda.Runtime.NODEJS_18_X,
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

		// Optional step: resolve using nRF Cloud API
		let fromNrfCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfcloudGroundFix',
			component: 'nRF Cloud API (ground fix)',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
					layers: lambdas.layers,
					handler: 'index.handler',
					architecture: Lambda.Architecture.ARM_64,
					runtime: Lambda.Runtime.NODEJS_18_X,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: lambdas.lambdas.geolocateCellFromNrfCloudStepFunction,
					description: 'Resolve cell geolocation using the nRF Cloud API',
					initialPolicy: [
						logToCloudWatch,
						new IAM.PolicyStatement({
							actions: ['ssm:GetParametersByPath'],
							resources: [
								`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/thirdParty/nrfcloud`,
							],
						}),
					],
					environment: {
						VERSION: this.node.tryGetContext('version'),
						STACK_NAME: this.stack.stackName,
					},
				})

				new LambdaLogGroup(this, 'fromNrfCloudLogs', fromNrfCloud)
			},
		})

		const isGeolocated = StepFunctions.Condition.booleanEquals(
			'$.cellgeo.located',
			true,
		)

		const stateMachineRole = new IAM.Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-cellGeo`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
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
											fromNrfCloud === undefined
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
													result: StepFunctions.Result.fromString(source),
												},
											)
										const branches: StepFunctions.IChainable[] = []
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
										if (fromNrfCloud !== undefined) {
											branches.push(
												new StepFunctionTasks.LambdaInvoke(
													this,
													'Resolve using nRF Cloud API',
													{
														lambdaFunction: fromNrfCloud,
														payloadResponseOnly: true,
													},
												).next(markSource('nrfcloud')),
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
										): [StepFunctions.Condition, StepFunctions.IChainable] => [
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
												(() => {
													const choice = new StepFunctions.Choice(
														this,
														'Resolved from any third party API?',
													)

													for (let i = 0; i < branches.length; i++) {
														choice.when(...checkApiResult(i))
													}

													choice.otherwise(
														new StepFunctions.Pass(
															this,
															'no: mark cell as not located',
															{
																resultPath: '$.cellgeo',
																result: StepFunctions.Result.fromObject({
																	located: false,
																}),
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
													)

													return choice
												})(),
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
