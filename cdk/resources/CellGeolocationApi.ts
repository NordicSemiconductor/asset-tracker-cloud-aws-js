import * as CloudFormation from 'aws-cdk-lib'
import * as HttpApi from 'aws-cdk-lib/aws-apigatewayv2'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import * as CloudWatchLogs from 'aws-cdk-lib/aws-logs'
import * as SQS from 'aws-cdk-lib/aws-sqs'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import type { CellGeolocation } from './CellGeolocation.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import { logToCloudWatch } from './logToCloudWatch.js'

/**
 * Allows to resolve cell geolocations using a HTTP API
 *
 * This API is public because it does not expose critical information.
 * If you want to protect this API, look into enabling Authentication on HTTP APIs here: https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html
 */
export class CellGeolocationApi extends CloudFormation.Resource {
	public readonly api: HttpApi.CfnApi
	public readonly stage: HttpApi.CfnStage

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cellgeo,
			lambdas,
		}: {
			cellgeo: CellGeolocation
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
		},
	) {
		super(parent, id)

		const resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${`${id}-${this.stack.stackName}`.slice(0, 75)}.fifo`,
		})

		const fromSQS = new Lambda.Function(this, 'fromSQS', {
			handler: lambdas.lambdas.invokeStepFunctionFromSQS.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.invokeStepFunctionFromSQS.zipFile,
			),
			layers: lambdas.layers,
			description:
				'Invoke the cell geolocation resolution step function for SQS messages',
			initialPolicy: [logToCloudWatch],
			environment: {
				STEP_FUNCTION_ARN: cellgeo.stateMachine.stateMachineArn,
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

		cellgeo.stateMachine.grantStartExecution(fromSQS)

		const getCell = new Lambda.Function(this, 'getCell', {
			layers: lambdas.layers,
			handler: lambdas.lambdas.geolocateCellHttpApi.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(lambdas.lambdas.geolocateCellHttpApi.zipFile),
			description: 'Geolocate cells',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:GetItem'],
					resources: [cellgeo.cacheTable.tableArn],
				}),
				new IAM.PolicyStatement({
					resources: [resolutionJobsQueue.queueArn],
					actions: ['sqs:SendMessage'],
				}),
			],
			environment: {
				CACHE_TABLE: cellgeo.cacheTable.tableName,
				CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE: resolutionJobsQueue.queueUrl,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'getCellLogs', getCell)

		this.api = new HttpApi.CfnApi(this, 'httpApi', {
			name: 'Cell Geolocation',
			description: 'Cell Geolocation HTTP API',
			protocolType: 'HTTP',
		})
		this.stage = new HttpApi.CfnStage(this, 'stage', {
			apiId: this.api.ref,
			stageName: '2020-10-26',
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
				logGroupName: `/${this.stack.stackName}/cell/apiAccessLogs`,
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

		// GET /cell

		const geolocateIntegration = new HttpApi.CfnIntegration(
			this,
			'geolocateIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: integrationUri(getCell),
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const geolocateRoute = new HttpApi.CfnRoute(this, 'geolocateRoute', {
			apiId: this.api.ref,
			routeKey: 'GET /cell',
			target: `integrations/${geolocateIntegration.ref}`,
		})

		getCell.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/GET/cell`,
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
		deployment.node.addDependency(geolocateRoute)
	}
}
