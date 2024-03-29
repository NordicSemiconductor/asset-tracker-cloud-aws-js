import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import Lambda from 'aws-cdk-lib/aws-lambda'
import Logs from 'aws-cdk-lib/aws-logs'
import StepFunctions, { DefinitionBody } from 'aws-cdk-lib/aws-stepfunctions'
import StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from '../stacks/stackName.js'
import type { AGNSSStorage } from './AGNSSStorage.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'

/**
 * Provides a state machine that can resolve A-GNSS requests
 */
export class AGNSSResolver extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
			storage: AGNSSStorage
		},
	) {
		super(parent, id)

		const fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
			layers: lambdas.layers,
			handler: lambdas.lambdas.agnssNrfCloudStepFunction.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.agnssNrfCloudStepFunction.zipFile,
			),
			description: 'Use the nRF Cloud API to provide A-GNSS data for devices',
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

		const stateMachineRole = new IAM.Role(this, 'stateMachineRole', {
			assumedBy: new IAM.ServicePrincipal('states.amazonaws.com'),
		})

		const persistResult = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Persist result from API',
			{
				table: storage.cacheTable,
				key: {
					cacheKey: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.cacheKey'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved, #dataHex = :dataHex, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#dataHex': 'dataHex',
					'#updatedAt': 'updatedAt',
				},
				expressionAttributeValues: {
					':unresolved':
						StepFunctionTasks.DynamoAttributeValue.fromBoolean(false),
					':dataHex': StepFunctionTasks.DynamoAttributeValue.fromStringSet(
						StepFunctions.JsonPath.listAt('$.agnss.dataHex'),
					),
					':updatedAt': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		).next(new StepFunctions.Succeed(this, 'Done (resolved using API)'))

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
				resultPath: '$.agnss',
				result: StepFunctions.Result.fromObject({ located: false }),
			},
		)
			.next(persistFailure)
			.next(
				new StepFunctions.Fail(this, 'Failed (no resolution)', {
					error: 'FAILED',
					cause: 'The A-GNSS request could not be resolved',
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
			stateMachineName: `${this.stack.stackName}-agnss`,
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
							new StepFunctionTasks.LambdaInvoke(
								this,
								'Resolve using nRF Cloud API',
								{
									lambdaFunction: fromNrfCloud,
									payloadResponseOnly: true,
									resultPath: '$.agnss',
								},
							).next(
								new StepFunctions.Choice(this, 'resolved from nRF Cloud API')
									.when(
										StepFunctions.Condition.booleanEquals(
											`$.agnss.resolved`,
											true,
										),
										persistResult,
									)
									.otherwise(noApiResult),
							),
						),
				),
			),
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
