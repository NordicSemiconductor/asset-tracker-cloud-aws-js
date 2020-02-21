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

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cellGeolocationCacheTable,
			sourceCodeBucket,
			baseLayer,
			lambdas,
		}: {
			cellGeolocationCacheTable: DynamoDB.ITable
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

		this.api = new HttpApi.CfnApi(this, 'httpApi', {
			name: 'Cell Geolocation',
			description: 'Resolves geolocations for cells',
			protocolType: 'HTTP',
			target: geolocateCellFromCache.functionArn,
		})

		geolocateCellFromCache.addPermission('invokeByHttpApi', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: `arn:aws:execute-api:${this.stack.region}:${this.stack.account}:${this.api.ref}/*/$default`,
		})
	}
}
