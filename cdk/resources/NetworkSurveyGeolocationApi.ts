import * as CloudFormation from 'aws-cdk-lib'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { NetworkSurveyGeolocation } from './NetworkSurveyGeolocation'
import { NetworkSurveysStorage } from './NetworkSurveysStorage'

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
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			geolocation: NetworkSurveyGeolocation
		},
	) {
		super(parent, id)

		const getSurveyLocation = new Lambda.Function(this, 'lambda', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(60),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateNetworkSurveyHttpApi,
			description: 'Geolocate Network survey',
			environment: {
				SURVEYS_TABLE: storage.surveysTable.tableName,
				STEP_FUNCTION_ARN: geolocation.stateMachine.stateMachineArn,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})
		new LambdaLogGroup(this, 'logs', getSurveyLocation)

		storage.surveysTable.grantFullAccess(getSurveyLocation)

		geolocation.stateMachine.grantStartExecution(getSurveyLocation)

		this.url = getSurveyLocation.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		}).url
	}
}
