import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as SQS from 'aws-cdk-lib/aws-sqs'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { CORE_STACK_NAME } from '../stacks/stackName'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { logToCloudWatch } from './logToCloudWatch'
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
			visibilityTimeout: CloudFormation.Duration.seconds(60),
			retentionPeriod: CloudFormation.Duration.seconds(600),
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
		new LambdaLogGroup(this, 'getSurveyLocationLogs', getSurveyLocation)

		const resolveSurveyLocation = new Lambda.Function(
			this,
			'resolveSurveyLocation',
			{
				handler: 'index.handler',
				architecture: Lambda.Architecture.ARM_64,
				runtime: Lambda.Runtime.NODEJS_18_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: lambdas.lambdas.wifiSiteSurveyGeolocateResolverFromSQS,
				layers: lambdas.layers,
				description: `Invoke the WiFi site survey's geolocation resolution for SQS messages`,
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
					SURVEYS_TABLE: storage.surveysTable.tableName,
					VERSION: this.node.tryGetContext('version'),
					STACK_NAME: this.stack.stackName,
				},
			},
		)
		new LambdaLogGroup(this, 'resolveSurveyLocationLogs', resolveSurveyLocation)

		resolveSurveyLocation.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: resolutionJobsQueue.queueArn,
		})

		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: resolutionJobsQueue.queueArn,
			target: resolveSurveyLocation,
			batchSize: 1,
		})

		storage.surveysTable.grantFullAccess(getSurveyLocation)
		storage.surveysTable.grantFullAccess(resolveSurveyLocation)

		resolutionJobsQueue.grantSendMessages(getSurveyLocation)
		resolutionJobsQueue.grantConsumeMessages(resolveSurveyLocation)

		this.url = getSurveyLocation.addFunctionUrl({
			authType: Lambda.FunctionUrlAuthType.NONE,
		}).url
	}
}
