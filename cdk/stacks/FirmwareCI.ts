import * as CloudFormation from '@aws-cdk/core'
import * as Cognito from '@aws-cdk/aws-cognito'
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

		const userPool = Cognito.UserPool.fromUserPoolId(
			this,
			`userPool`,
			CloudFormation.Fn.importValue(`${bifravstStackId}:userPoolId`),
		)

		const thingGroupLambda = Lambda.Function.fromFunctionArn(
			this,
			'thingGroupLambda',
			CloudFormation.Fn.importValue(`${bifravstStackId}:thingGroupLambdaArn`),
		)

		const firmwareCI = new FirmwareCI(this, 'firmwareCI', {
			identityPool: {
				ref: CloudFormation.Fn.importValue(`${bifravstStackId}:identityPoolId`),
			} as Cognito.CfnIdentityPool,
			thingGroupLambda,
			userPool,
		})

		new CloudFormation.CfnOutput(this, 'ciThingGroupName', {
			value: firmwareCI.thingGroupName,
			exportName: `${this.stackName}:ciThingGroupName`,
		})

		new CloudFormation.CfnOutput(this, 'resultsBucketName', {
			value: firmwareCI.resultsBucket.bucketName,
			exportName: `${this.stackName}:resultsBucketName`,
		})
	}
}

export type StackOutputs = {
	ciThingGroupName: string
}
