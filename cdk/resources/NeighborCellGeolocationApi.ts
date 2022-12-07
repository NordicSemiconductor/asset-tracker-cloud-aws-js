import * as CloudFormation from 'aws-cdk-lib'
import * as HttpApi from 'aws-cdk-lib/aws-apigatewayv2'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as CloudWatchLogs from 'aws-cdk-lib/aws-logs'
import * as SQS from 'aws-cdk-lib/aws-sqs'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { LambdaLogGroup } from './LambdaLogGroup'
import { LambdasWithLayer } from './LambdasWithLayer'
import { logToCloudWatch } from './logToCloudWatch'
import { NeighborCellGeolocation } from './NeighborCellGeolocation'
import { NeighborCellMeasurementsStorage } from './NeighborCellMeasurementsStorage'

/**
 * Provides geo-location for neighboring cell measurement report from devices through a HTTP API
 *
 * This API is public because it does not expose critical information.
 * If you want to protect this API, look into enabling Authentication on HTTP APIs here: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
 */
export class NeighborCellGeolocationApi extends CloudFormation.Resource {
	public readonly api: HttpApi.CfnApi
	public readonly stage: HttpApi.CfnStage

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			geolocation,
			storage,
			lambdas,
		}: {
			geolocation: NeighborCellGeolocation
			storage: NeighborCellMeasurementsStorage
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
		},
	) {
		super(parent, id)

		const resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${`${id}-${this.stack.stackName}`.slice(0, 75)}.fifo`,
		})

		const fromSQS = new Lambda.Function(this, 'fromSQS', {
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.invokeStepFunctionFromSQS,
			layers: lambdas.layers,
			description:
				'Invoke the neighboring cell geolocation resolution step function for SQS messages',
			initialPolicy: [logToCloudWatch],
			environment: {
				STEP_FUNCTION_ARN: geolocation.stateMachine.stateMachineArn,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'fromSQSLogs', fromSQS)

		fromSQS.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: resolutionJobsQueue.queueArn,
		})

		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: resolutionJobsQueue.queueArn,
			target: fromSQS,
			batchSize: 10,
		})

		resolutionJobsQueue.grantConsumeMessages(fromSQS)

		geolocation.stateMachine.grantStartExecution(fromSQS)

		const getReportLocation = new Lambda.Function(this, 'getReportLocation', {
			layers: lambdas.layers,
			handler: 'index.handler',
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.neighborCellGeolocateReportHttpApi,
			description: 'Geolocate neighboring cell measurement report',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:GetItem', 'dynamodb:Query'],
					resources: [
						storage.reportsTable.tableArn,
						`${storage.reportsTable.tableArn}/*`,
					],
				}),
				new IAM.PolicyStatement({
					resources: [resolutionJobsQueue.queueArn],
					actions: ['sqs:SendMessage'],
				}),
			],
			environment: {
				REPORTS_TABLE: storage.reportsTable.tableName,
				NEIGHBOR_CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE:
					resolutionJobsQueue.queueUrl,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'getReportLocationLogs', getReportLocation)

		this.api = new HttpApi.CfnApi(this, 'httpApi', {
			name: 'Neighboring Cell Geolocation',
			description: 'Neighboring Cell Geolocation HTTP API',
			protocolType: 'HTTP',
		})
		this.stage = new HttpApi.CfnStage(this, 'stage', {
			apiId: this.api.ref,
			stageName: '2021-07-07',
			autoDeploy: true,
		})

		const isTest = this.node.tryGetContext('isTest') === true
		const httpApiLogGroup = new CloudWatchLogs.LogGroup(
			this,
			`HttpApiLogGroup`,
			{
				removalPolicy: isTest
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
				logGroupName: `/${this.stack.stackName}/neighboringcell/apiAccessLogs`,
				retention:
					this.node.tryGetContext('isTest') === true
						? CloudWatchLogs.RetentionDays.ONE_DAY
						: CloudWatchLogs.RetentionDays.ONE_WEEK,
			},
		)
		this.stage.accessLogSettings = {
			destinationArn: httpApiLogGroup.logGroupArn,
			format: JSON.stringify({
				requestId: '$context.requestId',
				awsEndpointRequestId: '$context.awsEndpointRequestId',
				requestTime: '$context.requestTime',
				ip: '$context.identity.sourceIp',
				protocol: '$context.protocol',
				routeKey: '$context.routeKey',
				status: '$context.status',
				responseLength: '$context.responseLength',
				integrationLatency: '$context.integrationLatency',
				integrationStatus: '$context.integrationStatus',
				integrationErrorMessage: '$context.integrationErrorMessage',
				integration: {
					status: '$context.integration.status',
				},
			}),
		}
		this.stage.node.addDependency(httpApiLogGroup)

		const integrationUri = (f: Lambda.IFunction) =>
			`arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${this.stack.region}:${this.stack.account}:function:${f.functionName}/invocations`

		// GET /report/{id}/location

		const getReportLocationIntegration = new HttpApi.CfnIntegration(
			this,
			'getReportLocationIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: integrationUri(getReportLocation),
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const getReportLocationRoute = new HttpApi.CfnRoute(
			this,
			'getReportLocationRoute',
			{
				apiId: this.api.ref,
				routeKey: 'GET /report/{id}/location',
				target: `integrations/${getReportLocationIntegration.ref}`,
			},
		)

		getReportLocation.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/GET/report/*/location`,
		})

		// Add $default route, this is a attempt to fix https://github.com/NordicSemiconductor/asset-tracker-cloud-aws-js/issues/455
		new HttpApi.CfnRoute(this, 'defaultRoute', {
			apiId: this.api.ref,
			routeKey: '$default',
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName,
		})
		deployment.node.addDependency(this.stage)
		deployment.node.addDependency(getReportLocationRoute)
	}
}
