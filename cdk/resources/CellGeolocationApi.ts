import * as CloudFormation from '@aws-cdk/core'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'
import * as IAM from '@aws-cdk/aws-iam'
import * as Lambda from '@aws-cdk/aws-lambda'
import { BifravstLambdas, CDKLambdas } from '../prepare-resources.js'
import { logToCloudWatch } from './logToCloudWatch.js'
import { CellGeolocation } from './CellGeolocation.js'
import { LambdasWithLayer } from './LambdasWithLayer.js'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'
import { LambdaLogGroup } from './LambdaLogGroup.js'

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
			cdkLambdas,
		}: {
			cellgeo: CellGeolocation
			lambdas: LambdasWithLayer<BifravstLambdas>
			cdkLambdas: LambdasWithLayer<CDKLambdas>
		},
	) {
		super(parent, id)

		const getCell = new Lambda.Function(this, 'getCell', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
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
					resources: [cellgeo.resolutionJobsQueue.queueArn],
					actions: ['sqs:SendMessage'],
				}),
			],
			environment: {
				CACHE_TABLE: cellgeo.cacheTable.tableName,
				CELL_GEOLOCATION_RESOLUTION_JOBS_QUEUE:
					cellgeo.resolutionJobsQueue.queueUrl,
				VERSION: this.node.tryGetContext('version'),
			},
		})

		new LambdaLogGroup(this, 'getCellLogs', getCell)

		const addCell = new Lambda.Function(this, 'addCell', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
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
						cellgeo.deviceCellGeolocationTable.tableArn,
					],
				}),
			],
			environment: {
				CACHE_TABLE: cellgeo.cacheTable.tableName,
				DEVICE_CELL_GEOLOCATION_TABLE:
					cellgeo.deviceCellGeolocationTable.tableName,
				VERSION: this.node.tryGetContext('version'),
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

		const httpApiLogGroup = new CloudWatchLogs.LogGroup(
			this,
			`HttpApiLogGroup`,
			{
				removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
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

		// GET __health

		const healthCheck = new Lambda.Function(this, 'healthCheck', {
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
			timeout: CloudFormation.Duration.seconds(10),
			code: cdkLambdas.lambdas.httpApiHealth,
			description: 'HTTP API Health Check',
			initialPolicy: [logToCloudWatch],
			environment: {
				VERSION: this.node.tryGetContext('version'),
			},
		})

		new LambdaLogGroup(this, 'healthCheckLogs', healthCheck)

		const integrationUri = (f: Lambda.IFunction) =>
			`arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${this.stack.region}:${this.stack.account}:function:${f.functionName}/invocations`

		const healthCheckIntegration = new HttpApi.CfnIntegration(
			this,
			'healthCheckIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: integrationUri(healthCheck),
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const healthCheckRoute = new HttpApi.CfnRoute(this, 'healthCheckRoute', {
			apiId: this.api.ref,
			routeKey: 'GET /__health',
			target: `integrations/${healthCheckIntegration.ref}`,
		})

		healthCheck.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/GET/__health`,
		})

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

		// Add $default route, this is a attempt to fix https://github.com/bifravst/aws/issues/455
		new HttpApi.CfnRoute(this, 'defaultRoute', {
			apiId: this.api.ref,
			routeKey: '$default',
		})

		const deployment = new HttpApi.CfnDeployment(this, 'deployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName,
		})
		deployment.node.addDependency(this.stage)
		deployment.node.addDependency(healthCheckRoute)
		deployment.node.addDependency(geolocateRoute)
		deployment.node.addDependency(geolocationRoute)
	}
}
