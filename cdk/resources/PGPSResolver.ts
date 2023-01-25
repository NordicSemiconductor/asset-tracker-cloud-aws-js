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
import { PGPSStorage } from './PGPSStorage'

/**
 * Provides a state machine that can resolve P-GPS requests
 */
export class PGPSResolver extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: PGPSStorage
		},
	) {
		super(parent, id)

		const checkFlag = enabledInContext(this.node)

		// Optional step: resolve using nRF Cloud API
		let fromNrfCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfcloudPGPS',
			component: 'nRF Cloud API (P-GPS)',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
					layers: lambdas.layers,
					handler: 'index.handler',
					architecture: Lambda.Architecture.ARM_64,
					runtime: Lambda.Runtime.NODEJS_18_X,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: lambdas.lambdas.pgpsNrfCloudStepFunction,
					description:
						'Use the nRF Cloud API to provide P-GPS data for devices',
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

		const stateMachineRole = new IAM.Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		const persistResult = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Persist result from third party API',
			{
				table: storage.cacheTable,
				key: {
					cacheKey: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.cacheKey'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved, #url = :url, #source = :source, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#url': 'url',
					'#source': 'source',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved':
						StepFunctionTasks.DynamoAttributeValue.fromBoolean(false),
					':url': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.pgps.url'),
					),
					':source': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.pgps.source'),
					),
					':updatedAt': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		).next(
			new StepFunctions.Succeed(this, 'Done (resolved using third party API)'),
		)

		const checkApiResult = (
			n: number,
		): [StepFunctions.Condition, StepFunctions.IChainable] => [
			StepFunctions.Condition.booleanEquals(`$.pgps[${n}].resolved`, true),
			new StepFunctions.Pass(
				this,
				`yes: write location data from result ${n} to input`,
				{
					resultPath: '$.pgps',
					inputPath: `$.pgps[${n}]`,
				},
			).next(persistResult),
		]

		const persistFailure = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Persist resolution failure',
			{
				table: storage.cacheTable,
				key: {
					cacheKey: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.cacheKey'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved,  #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved':
						StepFunctionTasks.DynamoAttributeValue.fromBoolean(true),
					':updatedAt': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		)

		const noApiResult = new StepFunctions.Pass(
			this,
			'no: mark request as not resolved',
			{
				resultPath: '$.pgps',
				result: StepFunctions.Result.fromObject({ located: false }),
			},
		)
			.next(persistFailure)
			.next(
				new StepFunctions.Fail(this, 'Failed (no resolution)', {
					error: 'FAILED',
					cause: 'The P-GPS request could not be resolved',
				}),
			)

		const fetchCache = new StepFunctionTasks.DynamoGetItem(
			this,
			'fetch cached data',
			{
				table: storage.cacheTable,
				key: {
					cacheKey: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.cacheKey'),
					),
				},
				resultPath: '$.cached',
			},
		)

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-pgps`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definition: fetchCache.next(
				new StepFunctions.Choice(this, 'Already resolved?')
					.when(
						StepFunctions.Condition.and(
							StepFunctions.Condition.isPresent(
								`$.cached.Item.unresolved.BOOL`,
							),
							StepFunctions.Condition.booleanEquals(
								`$.cached.Item.unresolved.BOOL`,
								false,
							),
						),
						new StepFunctions.Succeed(this, 'Done (already resolved)'),
					)
					.otherwise(
						(() => {
							if (fromNrfCloud === undefined) {
								return new StepFunctions.Fail(this, 'Failed (No API)', {
									error: 'NO_API',
									cause:
										'No third party API is configured to resolve the P-GPS data',
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

							return new StepFunctions.Parallel(
								this,
								'Resolve using third party API',
								{
									resultPath: '$.pgps',
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

										choice.otherwise(noApiResult)
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