import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as StepFunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { enabledInContext } from '../helper/enabledInContext'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { logToCloudWatch } from './logToCloudWatch'
import { NeighborCellMeasurementsStorage } from './NeighborCellMeasurementsStorage'

/**
 * Describes the step functions which resolves the geolocation of neighboring cell measurement reports using third-party location providers
 */
export class NeighborCellGeolocation extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: NeighborCellMeasurementsStorage
		},
	) {
		super(parent, id)

		const checkFlag = enabledInContext(this.node)

		const fromResolved = new Lambda.Function(this, 'fromResolved', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateNeighborCellFromResolvedStepFunction,
			description: 'Checks if neighboring cell report is already geolocated',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:GetItem', 'dynamodb:Query'],
					resources: [
						storage.reportsTable.tableArn,
						`${storage.reportsTable.tableArn}/*`,
					],
				}),
			],
			environment: {
				REPORTS_TABLE: storage.reportsTable.tableName,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromResolvedLogs', fromResolved)

		// Optional step: resolve using nRF Cloud API
		let fromNrfCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfcloudCellLocation',
			component: 'nRF Cloud API (neighboring cell geolocation)',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
					layers: lambdas.layers,
					handler: 'index.handler',
					architecture: Lambda.Architecture.ARM_64,
					runtime: Lambda.Runtime.NODEJS_18_X,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: lambdas.lambdas.neighborCellGeolocationFromNrfCloudStepFunction,
					description:
						'Resolve device geolocation from neighboring cell measurement report using the nRF Cloud API',
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

		const persist = new Lambda.Function(this, 'persist', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.minutes(1),
			memorySize: 1792,
			code: lambdas.lambdas.persistNeighborCellGeolocationStepFunction,
			description: 'Persists neighboring cell measurement report geolocations',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:UpdateItem'],
					resources: [storage.reportsTable.tableArn],
				}),
			],
			environment: {
				REPORTS_TABLE: storage.reportsTable.tableName,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'persistLogs', persist)

		const stateMachineRole = new IAM.Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-ncellmeasGeo`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definition: new StepFunctionTasks.LambdaInvoke(
				this,
				'Check if already resolved',
				{
					lambdaFunction: fromResolved,
					resultPath: '$.ncellmeasgeo',
					payloadResponseOnly: true,
				},
			).next(
				new StepFunctions.Choice(this, 'Already resolved?')
					.when(
						StepFunctions.Condition.booleanEquals(
							'$.ncellmeasgeo.located',
							true,
						),
						new StepFunctions.Succeed(this, 'Done (already resolved)'),
					)
					.otherwise(
						(() => {
							if (fromNrfCloud === undefined) {
								return new StepFunctions.Fail(this, 'Failed (No API)', {
									error: 'NO_API',
									cause:
										'No third party API is configured to resolve the neighboring cell measurement report',
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

							const persistResult = new StepFunctionTasks.LambdaInvoke(
								this,
								'Persist result from third party API',
								{
									lambdaFunction: persist,
									resultPath: '$.persisted',
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
									`$.ncellmeasgeo[${n}].located`,
									true,
								),
								new StepFunctions.Pass(
									this,
									`yes: write location data from result ${n} to input`,
									{
										resultPath: '$.ncellmeasgeo',
										inputPath: `$.ncellmeasgeo[${n}]`,
									},
								).next(persistResult),
							]

							return new StepFunctions.Parallel(
								this,
								'Resolve using third party API',
								{
									resultPath: '$.ncellmeasgeo',
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
													resultPath: '$.ncellmeasgeo',
													result: StepFunctions.Result.fromObject({
														located: false,
													}),
												},
											)
												.next(
													new StepFunctionTasks.LambdaInvoke(
														this,
														'Persist resolution failure',
														{
															lambdaFunction: persist,
															resultPath: '$.persisted',
															payloadResponseOnly: true,
														},
													),
												)
												.next(
													new StepFunctions.Fail(
														this,
														'Failed (no resolution)',
														{
															error: 'FAILED',
															cause:
																'The neighboring cell measurement report could not be resolved',
														},
													),
												),
										)
										return choice
									})(),
								)
						})(),
					),
			),
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
