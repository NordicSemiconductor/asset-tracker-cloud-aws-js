import * as CloudFormation from '@aws-cdk/core'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as HttpApi from '@aws-cdk/aws-apigatewayv2'
import * as IAM from '@aws-cdk/aws-iam'
import * as S3 from '@aws-cdk/aws-s3'
import * as Lambda from '@aws-cdk/aws-lambda'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { BifravstLambdas } from '../prepare-resources'
import { logToCloudWatch } from './logToCloudWatch'

/**
 * Allows to resolve cell geolocations using a GraphQL API
 */
export class CellGeolocationApi extends CloudFormation.Resource {
	public readonly api: HttpApi.CfnApi
	public readonly stage: HttpApi.CfnStage

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cellGeolocationCacheTable,
			deviceCellGeolocationTable,
			sourceCodeBucket,
			baseLayer,
			lambdas,
		}: {
			cellGeolocationCacheTable: DynamoDB.ITable
			deviceCellGeolocationTable: DynamoDB.ITable
			sourceCodeBucket: S3.IBucket
			baseLayer: Lambda.ILayerVersion
			lambdas: LayeredLambdas<BifravstLambdas>
		},
	) {
		super(parent, id)

		const geolocateCellFromCache = new Lambda.Function(
			this,
			'geolocateCellFromCache',
			{
				layers: [baseLayer],
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					lambdas.lambdaZipFileNames.geolocateCellFromCacheHttpApi,
				),
				description: 'Geolocate cells from cache',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						actions: ['dynamodb:GetItem'],
						resources: [cellGeolocationCacheTable.tableArn],
					}),
				],
				environment: {
					CACHE_TABLE: cellGeolocationCacheTable.tableName,
				},
			},
		)

		const addCellGeolocation = new Lambda.Function(
			this,
			'addCellGeolocation',
			{
				layers: [baseLayer],
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					lambdas.lambdaZipFileNames.addCellGeolocationHttpApi,
				),
				description: 'Stores geolocations for cells',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						actions: ['dynamodb:PutItem'],
						resources: [
							cellGeolocationCacheTable.tableArn,
							deviceCellGeolocationTable.tableArn,
						],
					}),
				],
				environment: {
					CACHE_TABLE: cellGeolocationCacheTable.tableName,
					DEVICE_CELL_GEOLOCATION_TABLE: deviceCellGeolocationTable.tableName,
				},
			},
		)

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

		new HttpApi.CfnDeployment(this, 'httpApiDeployment', {
			apiId: this.api.ref,
			stageName: this.stage.stageName
		})

		const geolocateIntegration = new HttpApi.CfnIntegration(this, 'httpApiAddCellGeolocateIntegration', {
			apiId: this.api.ref,
			integrationType: 'AWS_PROXY',
			integrationUri: `arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/${geolocateCellFromCache.functionArn}/invocations`,
			integrationMethod: 'POST',
			payloadFormatVersion: '1.0'
		})

		new HttpApi.CfnRoute(this, 'httpApiAddCellGeolocateRoute', {
			apiId: this.api.ref,
			routeKey: 'GET /geolocate',
			target: `integrations/${geolocateIntegration.ref}`,
		})

		geolocateCellFromCache.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/GET/geolocate`,
		})

		const geolocationIntegration = new HttpApi.CfnIntegration(this, 'httpApiAddCellGeolocationIntegration', {
			apiId: this.api.ref,
			integrationType: 'AWS_PROXY',
			integrationUri: `arn:aws:apigateway:${this.stack.region}:lambda:path/2015-03-31/functions/${addCellGeolocation.functionArn}/invocations`,
			integrationMethod: 'POST',
			payloadFormatVersion: '1.0'
		})

		new HttpApi.CfnRoute(this, 'httpApiAddCellGeolocationRoute', {
			apiId: this.api.ref,
			routeKey: 'POST /geolocation',
			target: `integrations/${geolocationIntegration.ref}`,
		})

		addCellGeolocation.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/${this.stage.stageName}/POST/geolocation`,
		})
	}
}
