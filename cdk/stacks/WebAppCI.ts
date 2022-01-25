import * as CloudFormation from 'aws-cdk-lib'
import * as Cognito from 'aws-cdk-lib/aws-cognito'
import { WebAppCI } from '../resources/WebAppCI'
import { CORE_STACK_NAME, WEBAPP_CI_STACK_NAME } from './stackName'

export class WebAppCIStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, WEBAPP_CI_STACK_NAME)

		const webappCI = new WebAppCI(this, 'webappCI', {
			userPool: Cognito.UserPool.fromUserPoolArn(
				this,
				'userPoolArn',
				CloudFormation.Fn.importValue(`${CORE_STACK_NAME}:userPoolArn`),
			),
		})

		new CloudFormation.CfnOutput(this, 'userAccessKeyId', {
			value: webappCI.userAccessKey.ref,
			exportName: `${this.stackName}:userAccessKeyId`,
		})

		new CloudFormation.CfnOutput(this, 'userSecretAccessKey', {
			value: webappCI.userAccessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:userSecretAccessKey`,
		})
	}
}

export type StackOutputs = {
	userAccessKeyId: string
	userSecretAccessKey: string
}
