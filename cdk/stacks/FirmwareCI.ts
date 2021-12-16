import * as CloudFormation from 'aws-cdk-lib'
import { FirmwareCI } from '../resources/FirmwareCI'
import { CORE_STACK_NAME, FIRMWARE_CI_STACK_NAME } from './stackName'
import { aws_iam as IAM } from 'aws-cdk-lib'
import { Fn } from 'aws-cdk-lib'
export class FirmwareCIStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, FIRMWARE_CI_STACK_NAME)

		const firmwareCI = new FirmwareCI(this, 'firmwareCI', {
			jitpRole: IAM.Role.fromRoleArn(
				this,
				'jitpRole',
				Fn.importValue(`${CORE_STACK_NAME}:jitpRoleArn`),
			),
		})

		new CloudFormation.CfnOutput(this, 'bucketName', {
			value: firmwareCI.bucket.bucketName,
			exportName: `${this.stackName}:bucketName`,
		})

		new CloudFormation.CfnOutput(this, 'userAccessKeyId', {
			value: firmwareCI.userAccessKey.ref,
			exportName: `${this.stackName}:userAccessKeyId`,
		})

		new CloudFormation.CfnOutput(this, 'userSecretAccessKey', {
			value: firmwareCI.userAccessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:userSecretAccessKey`,
		})
	}
}

export type StackOutputs = {
	bucketName: string
	userAccessKeyId: string
	userSecretAccessKey: string
}
