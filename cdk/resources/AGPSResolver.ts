import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import Lambda from 'aws-cdk-lib/aws-lambda'
import StepFunctions, { DefinitionBody } from 'aws-cdk-lib/aws-stepfunctions'
import StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { enabledInContext } from '../helper/enabledInContext.js'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from '../stacks/stackName.js'
import type { AGPSStorage } from './AGPSStorage.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import { logToCloudWatch } from './logToCloudWatch.js'

/**
 * Provides a state machine that can resolve A-GPS requests
 */
export class AGPSResolver extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
			storage: AGPSStorage
		},
	) {
		super(parent, id)

		const checkFlag = enabledInContext(this.node)

		// Optional step: resolve using nRF Cloud API
		let fromNrfCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfcloudAGPS',
			component: 'nRF Cloud API (A-GPS)',
			onUndefined: 'disabled',
			onEnabled: () => {
				fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
					layers: lambdas.layers,
					handler: lambdas.lambdas.agpsNrfCloudStepFunction.handler,
					architecture: Lambda.Architecture.ARM_64,
					runtime: Lambda.Runtime.NODEJS_18_X,
					timeout: CloudFormation.Duration.seconds(10),
					memorySize: 1792,
					code: Lambda.Code.fromAsset(
						lambdas.lambdas.agpsNrfCloudStepFunction.zipFile,
					),
					description:
						'Use the nRF Cloud API to provide A-GPS data for devices',
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
					'SET #unresolved = :unresolved, #dataHex = :dataHex, #source = :source, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#dataHex': 'dataHex',
					'#source': 'source',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved':
						StepFunctionTasks.DynamoAttributeValue.fromBoolean(false),
					':dataHex': StepFunctionTasks.DynamoAttributeValue.fromStringSet(
						StepFunctions.JsonPath.listAt('$.agps.dataHex'),
					),
					':source': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.agps.source'),
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
			StepFunctions.Condition.booleanEquals(`$.agps[${n}].resolved`, true),
			new StepFunctions.Pass(
				this,
				`yes: write location data from result ${n} to input`,
				{
					resultPath: '$.agps',
					inputPath: `$.agps[${n}]`,
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
				resultPath: '$.agps',
				result: StepFunctions.Result.fromObject({ located: false }),
			},
		)
			.next(persistFailure)
			.next(
				new StepFunctions.Fail(this, 'Failed (no resolution)', {
					error: 'FAILED',
					cause: 'The A-GPS request could not be resolved',
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
			stateMachineName: `${this.stack.stackName}-agps`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definitionBody: DefinitionBody.fromChainable(
				fetchCache.next(
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
											'No third party API is configured to resolve the A-GPS data',
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
										resultPath: '$.agps',
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
			),
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
