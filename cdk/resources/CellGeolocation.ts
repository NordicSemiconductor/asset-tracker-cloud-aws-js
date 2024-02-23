import CloudFormation from 'aws-cdk-lib'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import IAM from 'aws-cdk-lib/aws-iam'
import Lambda from 'aws-cdk-lib/aws-lambda'
import StepFunctions, { DefinitionBody } from 'aws-cdk-lib/aws-stepfunctions'
import StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from '../stacks/stackName.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import Logs from 'aws-cdk-lib/aws-logs'

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
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
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
			handler: lambdas.lambdas.geolocateFromCacheStepFunction.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.geolocateFromCacheStepFunction.zipFile,
			),
			description: 'Geolocate cells from cache',
			initialPolicy: [
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
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})

		const addToCache = new Lambda.Function(this, 'addToCache', {
			layers: lambdas.layers,
			handler: lambdas.lambdas.cacheCellGeolocationStepFunction.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.minutes(1),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.cacheCellGeolocationStepFunction.zipFile,
			),
			description: 'Caches cell geolocations',
			initialPolicy: [
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
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})

		const fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
			layers: lambdas.layers,
			handler: lambdas.lambdas.geolocateCellFromNrfCloudStepFunction.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.geolocateCellFromNrfCloudStepFunction.zipFile,
			),
			description: 'Resolve cell geolocation using the nRF Cloud API',
			initialPolicy: [
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
			logRetention: Logs.RetentionDays.ONE_WEEK,
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
			definitionBody: DefinitionBody.fromChainable(
				new StepFunctionTasks.LambdaInvoke(this, 'Resolve from cache', {
					lambdaFunction: fromCache,
					resultPath: '$.cellgeo',
					payloadResponseOnly: true,
				}).next(
					new StepFunctions.Choice(this, 'Cache found?')
						.when(
							isGeolocated,
							new StepFunctions.Succeed(this, 'Done (already cached)'),
						)
						.otherwise(
							new StepFunctionTasks.LambdaInvoke(
								this,
								'Resolve using nRF Cloud API',
								{
									lambdaFunction: fromNrfCloud,
									payloadResponseOnly: true,
									resultPath: '$.cellgeo',
								},
							).next(
								new StepFunctions.Choice(
									this,
									'Resolved from nRF Cloud Location Services?',
								)
									.when(
										StepFunctions.Condition.booleanEquals(
											`$.cellgeo.located`,
											true,
										),
										new StepFunctionTasks.LambdaInvoke(
											this,
											'Cache result from nRF Cloud Location Services',
											{
												lambdaFunction: addToCache,
												resultPath: '$.storedInCache',
												payloadResponseOnly: true,
											},
										).next(
											new StepFunctions.Succeed(
												this,
												'Done (resolved using nRF Cloud Location Services)',
											),
										),
									)
									.otherwise(
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
												new StepFunctions.Fail(this, 'Failed (no resolution)', {
													error: 'FAILED',
													cause: 'The cell geolocation could not be resolved',
												}),
											),
										),
									),
							),
						),
				),
			),
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
