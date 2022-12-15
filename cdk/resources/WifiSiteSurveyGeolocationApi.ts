import * as CloudFormation from 'aws-cdk-lib'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as SQS from 'aws-cdk-lib/aws-sqs'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { WiFiSiteSurveysStorage } from './WiFiSiteSurveysStorage'

/**
 * Provides geo-location for WiFi site surveys from devices through a HTTP API
 *
 * This API is public because it does not expose critical information.
 * If you want to protect this API, look into enabling Authentication on HTTP APIs here: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
 */
export class WifiSiteSurveyGeolocationApi extends CloudFormation.Resource {
	public readonly url: string

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			storage,
			lambdas,
		}: {
			storage: WiFiSiteSurveysStorage
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
		},
	) {
		super(parent, id)

		const resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${`${id}-${this.stack.stackName}`.slice(0, 75)}.fifo`,
			visibilityTimeout: CloudFormation.Duration.seconds(60),
		})

		const getSurveyLocation = new Lambda.Function(this, 'getSurveyLocation', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(60),
			memorySize: 1792,
			code: lambdas.lambdas.wifiSiteSurveyGeolocateSurveyHttpApi,
			description: 'Geolocate WiFi site survey',
			environment: {
				SURVEYS_TABLE: storage.surveysTable.tableName,
				WIFI_SITESURVEY_GEOLOCATION_RESOLUTION_JOBS_QUEUE:
					resolutionJobsQueue.queueUrl,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		storage.surveysTable.grantFullAccess(getSurveyLocation)
		resolutionJobsQueue.grantSendMessages(getSurveyLocation)

		new LambdaLogGroup(this, 'getSurveyLocationLogs', getSurveyLocation)

		this.url = getSurveyLocation.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		}).url
	}
}
