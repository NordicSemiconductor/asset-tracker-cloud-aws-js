import * as CloudFormation from '@aws-cdk/core'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'
import * as IAM from '@aws-cdk/aws-iam'
import * as Lambda from '@aws-cdk/aws-lambda'
import { BifravstLambdas } from '../prepare-resources'
import { logToCloudWatch } from './logToCloudWatch'
import { CellGeolocation } from './CellGeolocation'
import { LambdasWithLayer } from './LambdasWithLayer'

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
			lambdas: LambdasWithLayer<BifravstLambdas>
		},
	) {
		super(parent, id)

		const geolocateCell = new Lambda.Function(this, 'geolocateCell', {
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
			},
		})

		const addCellGeolocation = new Lambda.Function(this, 'addCellGeolocation', {
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
			},
		})

		this.api = new HttpApi.CfnApi(this, 'httpApi', {
			name: 'Cell Geolocation',
			description: 'Cell Geolocation HTTP API',
			protocolType: 'HTTP',
		})

		this.stage = new HttpApi.CfnStage(this, 'httpApiStage', {
			apiId: this.api.ref,
			stageName: 'v1',
			autoDeploy: true,
		})

		const geolocateIntegration = new HttpApi.CfnIntegration(
			this,
			'httpApiAddCellGeolocateIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/${geolocateCell.functionArn}/invocations`,
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const geolocateRoute = new HttpApi.CfnRoute(
			this,
			'httpApiCellGeolocateRoute',
			{
				apiId: this.api.ref,
				routeKey: 'GET /cellgeolocation',
				target: `integrations/${geolocateIntegration.ref}`,
			},
		)

		geolocateCell.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/GET/cellgeolocation`,
		})

		const geolocationIntegration = new HttpApi.CfnIntegration(
			this,
			'httpApiAddCellGeolocationIntegration',
			{
				apiId: this.api.ref,
				integrationType: 'AWS_PROXY',
				integrationUri: `arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/${addCellGeolocation.functionArn}/invocations`,
				integrationMethod: 'POST',
				payloadFormatVersion: '1.0',
			},
		)

		const geolocationRoute = new HttpApi.CfnRoute(
			this,
			'httpApiAddCellGeolocationRoute',
			{
				apiId: this.api.ref,
				routeKey: 'POST /cellgeolocation',
				target: `integrations/${geolocationIntegration.ref}`,
			},
		)

		addCellGeolocation.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/POST/cellgeolocation`,
		})

		const deployment = new HttpApi.CfnDeployment(this, 'httpApiDeployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName,
		})
		deployment.node.addDependency(this.stage)
		deployment.node.addDependency(geolocateRoute)
		deployment.node.addDependency(geolocationRoute)
	}
}
