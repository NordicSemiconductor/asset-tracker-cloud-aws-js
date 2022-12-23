import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as StepFunctions from 'aws-cdk-lib/aws-stepfunctions'
import * as StepFunctionTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { logToCloudWatch } from './logToCloudWatch'
import { WifiSiteSurveysStorage } from './WifiSiteSurveysStorage'

/**
 * Describes the step functions which resolves the geolocation of wifi survey using nRF cloud location providers
 */
export class WifiSiteSurveyGeolocation extends CloudFormation.Resource {
	public readonly stateMachine: StepFunctions.IStateMachine
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: WifiSiteSurveysStorage
		},
	) {
		super(parent, id)

		const fromResolved = new Lambda.Function(this, 'fromResolved', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.wifiSiteSurveyGeolocateFromResolvedStepFunction,
			description: 'Checks if wifi survey is already resolved',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:GetItem', 'dynamodb:Query'],
					resources: [
						storage.surveysTable.tableArn,
						`${storage.surveysTable.tableArn}/*`,
					],
				}),
			],
			environment: {
				SURVEYS_TABLE: storage.surveysTable.tableName,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})
		new LambdaLogGroup(this, 'fromResolvedLogs', fromResolved)

		const persist = new Lambda.Function(this, 'persist', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.minutes(1),
			memorySize: 1792,
			code: lambdas.lambdas.persistWifiSiteSurveyGeolocateStepFunction,
			description: 'Persists wifi survey resolution',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:UpdateItem'],
					resources: [storage.surveysTable.tableArn],
				}),
			],
			environment: {
				SURVEYS_TABLE: storage.surveysTable.tableName,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})
		new LambdaLogGroup(this, 'persistLogs', persist)

		const fromNrfCloud = new Lambda.Function(this, 'fromNrfCloud', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.wifiSiteSurveyGeolocateFromNrfCloudStepFunction,
			description:
				'Resolve device geolocation from wifi survey using the nRF Cloud API',
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
		const done = new StepFunctions.Succeed(this, `Done`)

		// TODO:: We can skip this step if we can pass in the wifi survey rather than survey id
		const querySurvey = new StepFunctionTasks.LambdaInvoke(
			this,
			'Query wifi survey from DB',
			{
				lambdaFunction: fromResolved,
				resultPath: '$.wifisurveygeo',
				payloadResponseOnly: true,
			},
		)

		const resolveWifiSurvey = new StepFunctionTasks.LambdaInvoke(
			this,
			'Resolve wifi survey geolocation',
			{
				lambdaFunction: fromNrfCloud,
				inputPath: '$.wifisurveygeo.survey',
				resultPath: '$.wifisurveygeo',
				payloadResponseOnly: true,
			},
		)

		const persistResult = new StepFunctionTasks.LambdaInvoke(
			this,
			'Persist result from API',
			{
				lambdaFunction: persist,
				resultPath: '$.persisted',
				payloadResponseOnly: true,
			},
		)

		const definition = querySurvey.next(
			new StepFunctions.Choice(this, 'Already resolved?')
				.when(
					StepFunctions.Condition.booleanEquals(
						'$.wifisurveygeo.located',
						true,
					),
					done,
				)
				.otherwise(resolveWifiSurvey.next(persistResult).next(done)),
		)

		this.stateMachine = new StepFunctions.StateMachine(this, 'StateMachine', {
			stateMachineName: `${this.stack.stackName}-wifiSurveyGeo`,
			stateMachineType: StepFunctions.StateMachineType.STANDARD,
			definition,
			timeout: CloudFormation.Duration.minutes(5),
			role: stateMachineRole,
		})
	}
}
