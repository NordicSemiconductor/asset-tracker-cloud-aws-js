import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import Lambda from 'aws-cdk-lib/aws-lambda'
import StepFunctions, { DefinitionBody } from 'aws-cdk-lib/aws-stepfunctions'
import StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from '../stacks/stackName.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import type { NetworkSurveysStorage } from './NetworkSurveysStorage.js'
import Logs from 'aws-cdk-lib/aws-logs'

/**
 * Describes the step functions which resolves the geolocation of network survey using nRF Cloud Location Services
 */
export class NetworkSurveyGeolocation extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
			storage: NetworkSurveysStorage
		},
	) {
		super(parent, id)

		const fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
			layers: lambdas.layers,
			handler:
				lambdas.lambdas.networkSurveyGeolocateFromNrfCloudStepFunction.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.networkSurveyGeolocateFromNrfCloudStepFunction.zipFile,
			),
			description:
				'Resolve device geolocation from network survey using the nRF Cloud API',
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

		/**
		 * This is a STANDARD StepFunction because we want the user to be able to execute it and query it for the result.
		 * This is not possible with EXPRESS StepFunctions.
		 */
		const resolveNetworkSurvey = new StepFunctionTasks.LambdaInvoke(
			this,
			'Resolve network survey geolocation',
			{
				lambdaFunction: fromNrfCloud,
				resultPath: '$.networksurveygeo',
				payloadResponseOnly: true,
			},
		)

		const persistResult = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Update location from nRF cloud',
			{
				table: storage.surveysTable,
				key: {
					surveyId: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.surveyId'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved, #lat= :lat, #lng = :lng, #accuracy = :accuracy, #source = :source, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#lat': 'lat',
					'#lng': 'lng',
					'#accuracy': 'accuracy',
					'#updatedAt': 'updatedAt',
					'#source': 'source',
				},
				expressionAttributeValues: {
					':unresolved':
						StepFunctionTasks.DynamoAttributeValue.fromBoolean(false),
					':lat': StepFunctionTasks.DynamoAttributeValue.numberFromString(
						// It seems it is a bug from CDK, https://github.com/aws/aws-cdk/issues/12456
						StepFunctions.JsonPath.stringAt(
							`States.Format('{}', $.networksurveygeo.lat)`,
						),
					),
					':lng': StepFunctionTasks.DynamoAttributeValue.numberFromString(
						StepFunctions.JsonPath.stringAt(
							`States.Format('{}', $.networksurveygeo.lng)`,
						),
					),
					':accuracy': StepFunctionTasks.DynamoAttributeValue.numberFromString(
						StepFunctions.JsonPath.stringAt(
							`States.Format('{}', $.networksurveygeo.accuracy)`,
						),
					),
					':source': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt(
							`States.Format('{}', $.networksurveygeo.source)`,
						),
					),
					':updatedAt': StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$$.State.EnteredTime'),
					),
				},
			},
		).next(
			new StepFunctions.Succeed(this, 'Done (resolved using nRF Cloud API)'),
		)

		const persistFailure = new StepFunctionTasks.DynamoUpdateItem(
			this,
			'Update resolution failure',
			{
				table: storage.surveysTable,
				key: {
					surveyId: StepFunctionTasks.DynamoAttributeValue.fromString(
						StepFunctions.JsonPath.stringAt('$.surveyId'),
					),
				},
				updateExpression:
					'SET #unresolved = :unresolved, #updatedAt = :updatedAt',
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
		).next(
			new StepFunctions.Fail(this, 'Failed (no resolution)', {
				error: 'FAILED',
				cause: 'The Network survey request could not be resolved',
			}),
		)

		const checkAPIResult = new StepFunctions.Choice(
			this,
			'Resolved from nRF Cloud API?',
		)
			.when(
				StepFunctions.Condition.booleanEquals(
					`$.networksurveygeo.located`,
					true,
				),
				persistResult,
			)
			.otherwise(persistFailure)

		const definitionBody = DefinitionBody.fromChainable(
			resolveNetworkSurvey.next(checkAPIResult),
		)

		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-networkSurveyGeo`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definitionBody,
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
