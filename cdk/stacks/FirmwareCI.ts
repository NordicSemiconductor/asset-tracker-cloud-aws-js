import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import { FirmwareCI } from '../resources/FirmwareCI'

export class FirmwareCIStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		id: string,
		{
			bifravstStackId,
		}: {
			bifravstStackId: string
		},
	) {
		super(parent, id)

		const thingGroupLambda = Lambda.Function.fromFunctionArn(
			this,
			'thingGroupLambda',
			CloudFormation.Fn.importValue(`${bifravstStackId}:thingGroupLambdaArn`),
		)

		const firmwareCI = new FirmwareCI(this, 'firmwareCI', {
			thingGroupLambda,
		})

		new CloudFormation.CfnOutput(this, 'thingGroupName', {
			value: firmwareCI.thingGroupName,
			exportName: `${this.stackName}:thingGroupName`,
		})

		new CloudFormation.CfnOutput(this, 'resultsBucketName', {
			value: firmwareCI.resultsBucket.bucketName,
			exportName: `${this.stackName}:resultsBucketName`,
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
	thingGroupName: string
	resultsBucketName: string
	userAccessKeyId: string
	userSecretAccessKey: string
}
