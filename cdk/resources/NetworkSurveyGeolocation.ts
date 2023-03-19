import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as StepFunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from '../stacks/stackName.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import { logToCloudWatch } from './logToCloudWatch.js'
import type { NetworkSurveysStorage } from './NetworkSurveysStorage.js'

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
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: NetworkSurveysStorage
		},
	) {
		super(parent, id)

		const fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.networkSurveyGeolocateFromNrfCloudStepFunction,
			description:
				'Resolve device geolocation from network survey using the nRF Cloud API',
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
					'SET #unresolved = :unresolved, #lat= :lat, #lng = :lng, #accuracy = :accuracy, #updatedAt = :updatedAt',
				expressionAttributeNames: {
					'#unresolved': 'unresolved',
					'#lat': 'lat',
					'#lng': 'lng',
					'#accuracy': 'accuracy',
					'#updatedAt': 'updatedAt',
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

		const definition = resolveNetworkSurvey.next(checkAPIResult)

		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-networkSurveyGeo`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definition,
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
