import CloudFormation from 'aws-cdk-lib'
import Lambda from 'aws-cdk-lib/aws-lambda'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import type { NetworkSurveyGeolocation } from './NetworkSurveyGeolocation.js'
import type { NetworkSurveysStorage } from './NetworkSurveysStorage.js'
import Logs from 'aws-cdk-lib/aws-logs'

/**
 * Provides geo-location for Network surveys from devices through a HTTP API
 *
 * This API is public because it does not expose critical information.
 * If you want to protect this API, look into enabling Authentication on HTTP APIs here: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
 */
export class NetworkSurveyGeolocationApi extends CloudFormation.Resource {
	public readonly url: string

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			storage,
			lambdas,
			geolocation,
		}: {
			storage: NetworkSurveysStorage
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
			geolocation: NetworkSurveyGeolocation
		},
	) {
		super(parent, id)

		const getSurveyLocation = new Lambda.Function(this, 'lambda', {
			layers: lambdas.layers,
			handler: lambdas.lambdas.geolocateNetworkSurveyHttpApi.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.seconds(60),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.geolocateNetworkSurveyHttpApi.zipFile,
			),
			description: 'Geolocate Network survey',
			environment: {
				SURVEYS_TABLE: storage.surveysTable.tableName,
				STEP_FUNCTION_ARN: geolocation.stateMachine.stateMachineArn,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})

		storage.surveysTable.grantFullAccess(getSurveyLocation)

		geolocation.stateMachine.grantStartExecution(getSurveyLocation)

		this.url = getSurveyLocation.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		}).url
	}
}
