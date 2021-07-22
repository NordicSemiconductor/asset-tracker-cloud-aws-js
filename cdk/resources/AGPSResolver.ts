import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as StepFunctions from '@aws-cdk/aws-stepfunctions'
import * as StepFunctionTasks from '@aws-cdk/aws-stepfunctions-tasks'
import * as Lambda from '@aws-cdk/aws-lambda'
import { LambdaLogGroup } from './LambdaLogGroup'
import {
	Condition,
	IChainable,
	JsonPath,
	Result,
	StateMachineType,
} from '@aws-cdk/aws-stepfunctions'
import { Role } from '@aws-cdk/aws-iam'
import { LambdasWithLayer } from './LambdasWithLayer'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { enabledInContext } from '../helper/enabledInContext'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { AGPSStorage } from './AGPSStorage'
import { DynamoAttributeValue } from '@aws-cdk/aws-stepfunctions-tasks'
import { logToCloudWatch } from './logToCloudWatch'

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
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: AGPSStorage
		},
	) {
		super(parent, id)

		const checkFlag = enabledInContext(this.node)

		// Optional step: resolve using nRF Connect for Cloud API
		let fromNrfConnectForCloud: Lambda.IFunction | undefined = undefined
		checkFlag({
			key: 'nrfconnectforcloud',
			component: 'nRF Connect for Cloud API (A-GPS)',
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
						code: lambdas.lambdas.agpsNrfConnectForCloudStepFunction,
						description:
							'Use the nRF Connect for Cloud API to provide A-GPS data for devices',
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

		const persistResult = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Persist result from third party API',
			{
				table: storage.cacheTable,
				key: {
					cacheKey: DynamoAttributeValue.fromString(
						JsonPath.stringAt('$.cacheKey'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved, #data = :data, #source = :source, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#data': 'data',
					'#source': 'source',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved': DynamoAttributeValue.fromBoolean(false),
					':data': DynamoAttributeValue.fromStringSet(
						JsonPath.listAt('$.agps.data'),
					),
					':source': DynamoAttributeValue.fromString(
						JsonPath.stringAt('$.agps.source'),
					),
					':updatedAt': DynamoAttributeValue.fromString(
						JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		).next(
			new StepFunctions.Succeed(this, 'Done (resolved using third party API)'),
		)

		const checkApiResult = (n: number): [Condition, IChainable] => [
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
					cacheKey: DynamoAttributeValue.fromString(
						JsonPath.stringAt('$.cacheKey'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved,  #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved': DynamoAttributeValue.fromBoolean(true),
					':updatedAt': DynamoAttributeValue.fromString(
						JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		)

		const noApiResult = new StepFunctions.Pass(
			this,
			'no: mark request as not resolved',
			{
				resultPath: '$.agps',
				result: Result.fromObject({ located: false }),
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
					cacheKey: DynamoAttributeValue.fromString(
						JsonPath.stringAt('$.cacheKey'),
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
			stateMachineType: StateMachineType.STANDARD,
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
							if (fromNrfConnectForCloud === undefined) {
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
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
