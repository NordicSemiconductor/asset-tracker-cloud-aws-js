import * as CloudFormation from 'aws-cdk-lib'
import * as Cognito from 'aws-cdk-lib/aws-cognito'
import * as IAM from 'aws-cdk-lib/aws-iam'
import { CORE_STACK_NAME, WEBAPP_STACK_NAME } from '../stacks/stackName'

export class WebAppCI extends CloudFormation.Resource {
	public readonly userAccessKey
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{ userPool }: { userPool: Cognito.IUserPool },
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
				actions: ['iot:DescribeEndpoint'],
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

		this.userAccessKey = new IAM.CfnAccessKey(this, 'userAccessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
