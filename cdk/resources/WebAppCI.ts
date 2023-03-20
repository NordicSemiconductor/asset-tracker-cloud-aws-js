import CloudFormation from 'aws-cdk-lib'
import type * as Cognito from 'aws-cdk-lib/aws-cognito'
import type * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import IAM from 'aws-cdk-lib/aws-iam'
import { CORE_STACK_NAME, WEBAPP_STACK_NAME } from '../stacks/stackName.js'

export class WebAppCI extends CloudFormation.Resource {
	public readonly userAccessKey
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			userPool,
			networksurveyStorageTable,
			cellGeoLocationCacheTable,
			historicalDataTableArn,
		}: {
			userPool: Cognito.IUserPool
			networksurveyStorageTable: DynamoDB.ITable
			cellGeoLocationCacheTable: DynamoDB.ITable
			historicalDataTableArn: string
		},
	) {
		super(parent, id)

		const ciUser = new IAM.User(this, 'ciUser')

		// Write to IoT
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateThing',
					'iot:DescribeThing',
					'iot:GetThingShadow',
					'iot:UpdateThingShadow',
					'iot:DeleteThing',
				],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thing/web-app-ci-*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:DescribeEndpoint', 'iot:ListThings'],
				resources: [`*`],
			}),
		)

		// Get stack resource information for configuring the web app
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				resources: [
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${CORE_STACK_NAME}/*`,
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${WEBAPP_STACK_NAME}/*`,
				],
				actions: ['cloudformation:DescribeStacks'],
			}),
		)

		// Manage user accounts
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'cognito-idp:AdminConfirmSignUp',
					'cognito-idp:AdminUpdateUserAttributes',
					'cognito-idp:AdminDeleteUser',
				],
				resources: [userPool.userPoolArn],
			}),
		)

		// Read web app stack config
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${WEBAPP_STACK_NAME}/config/stack`,
				],
			}),
		)

		// Read stack config
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/config/stack`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${WEBAPP_STACK_NAME}/config/stack`,
				],
			}),
		)

		// Write to network survey reports table
		networksurveyStorageTable.grantWriteData(ciUser)

		// Write to cell geolocation cache
		cellGeoLocationCacheTable.grantWriteData(ciUser)

		// Write to timestream
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['*'],
				resources: [historicalDataTableArn],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'timestream:DescribeEndpoints',
					'timestream:SelectValues',
					'timestream:CancelQuery',
				],
				resources: ['*'],
			}),
		)

		this.userAccessKey = new IAM.CfnAccessKey(this, 'userAccessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
