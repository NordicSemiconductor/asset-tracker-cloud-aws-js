import * as CloudFormation from '@aws-cdk/core'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'
import * as IAM from '@aws-cdk/aws-iam'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as SQS from '@aws-cdk/aws-sqs'
import { logToCloudWatch } from './logToCloudWatch'
import { CellGeolocation } from './CellGeolocation'
import { LambdasWithLayer } from './LambdasWithLayer'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'
import { LambdaLogGroup } from './LambdaLogGroup'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import { DeviceCellGeolocations } from './DeviceCellGeolocations'

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
			deviceCellGeo,
			lambdas,
		}: {
			cellgeo: CellGeolocation
			deviceCellGeo: DeviceCellGeolocations
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
		},
	) {
		super(parent, id)

		const resolutionJobsQueue = new SQS.Queue(this, 'resolutionJobsQueue', {
			fifo: true,
			queueName: `${`${id}-${this.stack.stackName}`.substr(0, 75)}.fifo`,
		})

		const fromSQS = new Lambda.Function(this, 'fromSQS', {
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_14_X,

			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.invokeStepFunctionFromSQS,
			description:
				'Invoke the cell geolocation resolution step function for SQS messages',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: [
						'sqs:ReceiveMessage',
						'sqs:DeleteMessage',
						'sqs:GetQueueAttributes',
					],
					resources: [resolutionJobsQueue.queueArn],
				}),
			],
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

		cellgeo.stateMachine.grantStartExecution(fromSQS)

		const getCell = new Lambda.Function(this, 'getCell', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_14_X,

			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.geolocateCellHttpApi,
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

		const addCell = new Lambda.Function(this, 'addCell', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_14_X,

			timeout: CloudFormation.Duration.seconds(10),
			memorySize: 1792,
			code: lambdas.lambdas.addCellGeolocationHttpApi,
			description: 'Stores geolocations for cells',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['dynamodb:PutItem'],
					resources: [
						cellgeo.cacheTable.tableArn,
						deviceCellGeo.deviceCellGeolocationTable.tableArn,
					],
				}),
			],
			environment: {
				CACHE_TABLE: cellgeo.cacheTable.tableName,
				DEVICE_CELL_GEOLOCATION_TABLE:
					deviceCellGeo.deviceCellGeolocationTable.tableName,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
		})

		new LambdaLogGroup(this, 'addCellLogs', addCell)

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

		// POST /cell

		const geolocationIntegration = new HttpApi.CfnIntegration(
			this,
			'geolocationIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: integrationUri(addCell),
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const geolocationRoute = new HttpApi.CfnRoute(this, 'geolocationRoute', {
			apiId: this.api.ref,
			routeKey: 'POST /cell',
			target: `integrations/${geolocationIntegration.ref}`,
		})

		addCell.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/POST/cell`,
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
		deployment.node.addDependency(geolocationRoute)
	}
}
