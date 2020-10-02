import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { FirmwareCI } from '../resources/FirmwareCI'
import { ThingGroupLambda } from '../resources/ThingGroupLambda'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { BifravstLambdas } from '../prepare-resources'
import { FIRMWARE_CI_STACK_NAME } from './stackId'

export class FirmwareCIStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		{
			sourceCodeBucketName,
			cloudFormationLayerZipFileName,
			lambdas,
		}: {
			sourceCodeBucketName: string
			cloudFormationLayerZipFileName: string
			lambdas: LayeredLambdas<BifravstLambdas>
		},
	) {
		super(parent, FIRMWARE_CI_STACK_NAME)

		const sourceCodeBucket = S3.Bucket.fromBucketAttributes(
			this,
			'SourceCodeBucket',
			{
				bucketName: sourceCodeBucketName,
			},
		)

		const cloudFormationLayer = new Lambda.LayerVersion(
			this,
			`${FIRMWARE_CI_STACK_NAME}-cloudformation-layer`,
			{
				code: Lambda.Code.bucket(
					sourceCodeBucket,
					cloudFormationLayerZipFileName,
				),
				compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
			},
		)

		const thingGroupLambda = new ThingGroupLambda(this, 'thingGroupLambda', {
			cloudFormationLayer,
			lambdas,
			sourceCodeBucket,
		})

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
