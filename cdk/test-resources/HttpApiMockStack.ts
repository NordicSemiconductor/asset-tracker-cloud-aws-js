import * as CDK from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'
import * as IAM from '@aws-cdk/aws-iam'
import * as ApiGateway from '@aws-cdk/aws-apigateway'
import { LambdaLogGroup } from '../resources/LambdaLogGroup'
import { HTTP_MOCK_HTTP_API_STACK_NAME } from '../stacks/stackName'
import { HTTPAPIMockLambdas } from './prepare-test-resources'
import * as S3 from '@aws-cdk/aws-s3'
import { lambdasOnS3 } from '../resources/lambdasOnS3'
import { NodeJS14Runtime } from '../resources/NodeJS14Runtime'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'

/**
 * This is CloudFormation stack sets up a dummy HTTP API which stores all requests in SQS for inspection
 */
export class HttpApiMockStack extends CDK.Stack {
	public constructor(
		parent: CDK.App,
		{
			packedHTTPAPIMockLambdas,
			sourceCodeBucketName,
		}: {
			sourceCodeBucketName: string
			packedHTTPAPIMockLambdas: PackedLambdas<HTTPAPIMockLambdas>
		},
	) {
		super(parent, HTTP_MOCK_HTTP_API_STACK_NAME)

		// This table will store all the requests made to the API Gateway
		const requestsTable = new DynamoDB.Table(this, 'requests', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'methodPathQuery',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'requestId',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			timeToLiveAttribute: 'ttl',
		})

		// This table will store optional responses to be sent
		const responsesTable = new DynamoDB.Table(this, 'responses', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'methodPathQuery',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy: CDK.RemovalPolicy.DESTROY,
			timeToLiveAttribute: 'ttl',
		})

		const sourceCodeBucket = S3.Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: sourceCodeBucketName,
			},
		)
		const lambasOnBucket = lambdasOnS3(sourceCodeBucket)

		const httpAPIMockLambdaLayer = new Lambda.LayerVersion(
			this,
			`${HTTP_MOCK_HTTP_API_STACK_NAME}-cloudformation-layer`,
			{
				code: Lambda.Code.fromBucket(
					sourceCodeBucket,
					packedHTTPAPIMockLambdas.layerZipFileName,
				),
				// compatibleRuntimes: [Lambda.Runtime.NODEJS_14_X], // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
				compatibleRuntimes: [NodeJS14Runtime],
			},
		)

		const httpAPIMockLambdas = {
			lambdas: lambasOnBucket(packedHTTPAPIMockLambdas),
			layers: [httpAPIMockLambdaLayer],
		}

		// This lambda will publish all requests made to the API Gateway in the queue
		const lambda = new Lambda.Function(this, 'Lambda', {
			description:
				'Mocks a HTTP API and stores all requests in SQS for inspection, and optionally replies with enqued responses',
			code: httpAPIMockLambdas.lambdas.httpApiMock,
			layers: httpAPIMockLambdas.layers,
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
			timeout: CDK.Duration.seconds(5),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['arn:aws:logs:*:*:*'],
					actions: [
						'logs:CreateLogGroup',
						'logs:CreateLogStream',
						'logs:PutLogEvents',
					],
				}),
			],
			environment: {
				REQUESTS_TABLE_NAME: requestsTable.tableName,
				RESPONSES_TABLE_NAME: responsesTable.tableName,
			},
		})
		responsesTable.grantReadWriteData(lambda)
		requestsTable.grantReadWriteData(lambda)

		// Create the log group here, so we can control the retention
		new LambdaLogGroup(this, 'LambdaLogGroup', lambda)

		// This is the API Gateway, AWS CDK automatically creates a prod stage and deployment
		const api = new ApiGateway.RestApi(this, 'api', {
			restApiName: `HTTP Mock API for testing ${this.stackName}`,
			description: 'API Gateway to test outgoing requests',
		})
		const proxyResource = api.root.addResource('{proxy+}')
		proxyResource.addMethod('ANY', new ApiGateway.LambdaIntegration(lambda))
		// API Gateway needs to be able to call the lambda
		lambda.addPermission('InvokeByApiGateway', {
			principal: new IAM.ServicePrincipal('apigateway.amazonaws.com'),
			sourceArn: api.arnForExecuteApi(),
		})
		// Export these so the test runner can use them
		new CDK.CfnOutput(this, 'apiURL', {
			value: api.url,
			exportName: `${this.stackName}:apiURL`,
		})
		new CDK.CfnOutput(this, 'responsesTableName', {
			value: responsesTable.tableName,
			exportName: `${this.stackName}:responsesTableName`,
		})
		new CDK.CfnOutput(this, 'requestsTableName', {
			value: requestsTable.tableName,
			exportName: `${this.stackName}:requestsTableName`,
		})
	}
}

export type StackOutputs = {
	apiURL: string
	requestsTableName: string
	responsesTableName: string
}
