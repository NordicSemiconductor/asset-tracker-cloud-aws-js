import CDK from 'aws-cdk-lib'
import ApiGateway from 'aws-cdk-lib/aws-apigateway'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import IAM from 'aws-cdk-lib/aws-iam'
import Lambda from 'aws-cdk-lib/aws-lambda'
import { HTTP_MOCK_HTTP_API_STACK_NAME } from '../stacks/stackName.js'
import type { HTTPAPIMockLambdas } from './prepare-test-resources.js'
import Logs from 'aws-cdk-lib/aws-logs'

/**
 * This is CloudFormation stack sets up a dummy HTTP API which stores all requests in SQS for inspection
 */
export class HttpApiMockStack extends CDK.Stack {
	public constructor(
		parent: CDK.App,
		{
			packedHTTPAPIMockLambdas,
		}: {
			packedHTTPAPIMockLambdas: HTTPAPIMockLambdas
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

		const httpAPIMockLambdaLayer = new Lambda.LayerVersion(
			this,
			`${HTTP_MOCK_HTTP_API_STACK_NAME}-cloudformation-layer`,
			{
				code: Lambda.Code.fromAsset(packedHTTPAPIMockLambdas.layerZipFileName),
				compatibleRuntimes: [Lambda.Runtime.NODEJS_18_X],
			},
		)

		// This lambda will publish all requests made to the API Gateway in the queue
		const lambda = new Lambda.Function(this, 'Lambda', {
			description:
				'Mocks a HTTP API and stores all requests in SQS for inspection, and optionally replies with enqued responses',
			code: Lambda.Code.fromAsset(
				packedHTTPAPIMockLambdas.lambdas.httpApiMock.zipFile,
			),
			layers: [httpAPIMockLambdaLayer],
			handler: packedHTTPAPIMockLambdas.lambdas.httpApiMock.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CDK.Duration.seconds(5),
			environment: {
				REQUESTS_TABLE_NAME: requestsTable.tableName,
				RESPONSES_TABLE_NAME: responsesTable.tableName,
			},
			logRetention: Logs.RetentionDays.ONE_WEEK,
		})
		responsesTable.grantReadWriteData(lambda)
		requestsTable.grantReadWriteData(lambda)

		// This is the API Gateway, AWS CDK automatically creates a prod stage and deployment
		const api = new ApiGateway.RestApi(this, 'api', {
			restApiName: `HTTP Mock API for testing ${this.stackName}`,
			description: 'API Gateway to test outgoing requests',
			binaryMediaTypes: ['application/octet-stream'],
			cloudWatchRole: false,
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
