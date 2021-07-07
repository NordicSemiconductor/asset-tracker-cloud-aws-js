import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
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

		const fromCache = new Lambda.Function(this, 'fromCache', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_14_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateNeighborCellFromCacheStepFunction,
			description: 'Geolocate neighbor cell reports from cache',
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

		new LambdaLogGroup(this, 'fromCacheLogs', fromCache)

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
							.neighborCellGeolocationFromNrfConnectForCloudStepFunction,
						description:
							'Resolve device geolocation from neighboring cell measurement report using the nRF Connect for Cloud API',
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

		const stateMachineRole = new Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-ncellmeasGeo`,
			stateMachineType: StateMachineType.STANDARD,
			definition: new StepFunctionTasks.LambdaInvoke(
				this,
				'Resolve from cache',
				{
					lambdaFunction: fromCache,
					resultPath: '$.ncellmeasgeo',
					payloadResponseOnly: true,
				},
			).next(
				new StepFunctions.Choice(this, 'Cache found?')
					.when(
						StepFunctions.Condition.booleanEquals(
							'$.ncellmeasgeo.located',
							true,
						),
						new StepFunctions.Succeed(this, 'Done (already cached)'),
					)
					.otherwise(
						(() => {
							if (fromNrfConnectForCloud === undefined) {
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
										result: Result.fromString(source),
									},
								)
							const branches: IChainable[] = []
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

							const success = new StepFunctions.Succeed(
								this,
								'Done (resolved using third party API)',
							)

							const checkApiResult = (n: number): [Condition, IChainable] => [
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
								).next(success),
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
													result: Result.fromObject({ located: false }),
												},
											).next(
												new StepFunctions.Fail(this, 'Failed (no resolution)', {
													error: 'FAILED',
													cause:
														'The neighboring cell measurement report could not be resolved',
												}),
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
