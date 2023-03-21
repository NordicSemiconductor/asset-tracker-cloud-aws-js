import CloudFormation from 'aws-cdk-lib'
import type * as Cognito from 'aws-cdk-lib/aws-cognito'
import type * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import IAM from 'aws-cdk-lib/aws-iam'
import { CORE_STACK_NAME, WEBAPP_STACK_NAME } from '../stacks/stackName.js'

export class WebAppCI extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			userPool,
			networksurveyStorageTable,
			cellGeoLocationCacheTable,
			historicalDataTableArn,
			repository: r,
		}: {
			userPool: Cognito.IUserPool
			networksurveyStorageTable: DynamoDB.ITable
			cellGeoLocationCacheTable: DynamoDB.ITable
			historicalDataTableArn: string
			repository: {
				owner: string
				repo: string
			}
		},
	) {
		super(parent, id)

		const githubDomain = 'token.actions.githubusercontent.com'
		const ghProvider = new IAM.OpenIdConnectProvider(this, 'githubProvider', {
			url: `https://${githubDomain}`,
			clientIds: ['sts.amazonaws.com'],
			thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
		})

		const ciRole = new IAM.Role(this, 'ciRole', {
			roleName: `${this.stack.stackName}-github-actions`,
			assumedBy: new IAM.WebIdentityPrincipal(
				ghProvider.openIdConnectProviderArn,
				{
					StringEquals: {
						[`${githubDomain}:sub`]: `repo:${r.owner}/${r.repo}:environment:production`, // `repo:${r.owner}/${r.repo}:ref:refs/heads/*`,
						'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
					},
				},
			),
			description: `This role is used by GitHub Actions to run CI tests against the web application`,
			maxSessionDuration: CloudFormation.Duration.hours(1),
		})

		// Write to IoT
		ciRole.addToPolicy(
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
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:DescribeEndpoint', 'iot:ListThings'],
				resources: [`*`],
			}),
		)

		// Get stack resource information for configuring the web app
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: [
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${CORE_STACK_NAME}/*`,
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${WEBAPP_STACK_NAME}/*`,
				],
				actions: ['cloudformation:DescribeStacks'],
			}),
		)

		// Manage user accounts
		ciRole.addToPolicy(
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
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${WEBAPP_STACK_NAME}/config/stack`,
				],
			}),
		)

		// Read stack config
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${CORE_STACK_NAME}/config/stack`,
				],
			}),
		)
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['ssm:GetParametersByPath'],
				resources: [
					`arn:aws:ssm:${parent.region}:${parent.account}:parameter/${WEBAPP_STACK_NAME}/config/stack`,
				],
			}),
		)

		// Write to network survey reports table
		networksurveyStorageTable.grantWriteData(ciRole)

		// Write to cell geolocation cache
		cellGeoLocationCacheTable.grantWriteData(ciRole)

		// Write to timestream
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['*'],
				resources: [historicalDataTableArn],
			}),
		)
		ciRole.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'timestream:DescribeEndpoints',
					'timestream:SelectValues',
					'timestream:CancelQuery',
				],
				resources: ['*'],
			}),
		)
	}
}
