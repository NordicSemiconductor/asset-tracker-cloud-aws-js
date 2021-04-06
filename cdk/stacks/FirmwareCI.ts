import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { FirmwareCI } from '../resources/FirmwareCI'
import { ThingGroupLambda } from '../resources/ThingGroupLambda'
import { CORE_STACK_NAME, FIRMWARE_CI_STACK_NAME } from './stackName'
import { lambdasOnS3 } from '../resources/lambdasOnS3'
import * as IAM from '@aws-cdk/aws-iam'
import { Fn } from '@aws-cdk/core'
import { NodeJS14Runtime } from '../resources/NodeJS14Runtime'
import { CDKLambdas } from './AssetTracker/lambdas'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'

export class FirmwareCIStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		{
			sourceCodeBucketName,
			packedCDKLambdas,
		}: {
			sourceCodeBucketName: string
			packedCDKLambdas: PackedLambdas<CDKLambdas>
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
		const lambasOnBucket = lambdasOnS3(sourceCodeBucket)

		const cloudFormationLayer = new Lambda.LayerVersion(
			this,
			`${FIRMWARE_CI_STACK_NAME}-cloudformation-layer`,
			{
				code: Lambda.Code.fromBucket(
					sourceCodeBucket,
					packedCDKLambdas.layerZipFileName,
				),
				// compatibleRuntimes: [Lambda.Runtime.NODEJS_14_X], // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
				compatibleRuntimes: [NodeJS14Runtime],
			},
		)

		const thingGroupLambda = new ThingGroupLambda(this, 'thingGroupLambda', {
			cdkLambdas: {
				lambdas: lambasOnBucket(packedCDKLambdas),
				layers: [cloudFormationLayer],
			},
		})

		const firmwareCI = new FirmwareCI(this, 'firmwareCI', {
			thingGroupLambda,
			jitpRole: IAM.Role.fromRoleArn(
				this,
				'jitpRole',
				Fn.importValue(`${CORE_STACK_NAME}:jitpRoleArn`),
			),
		})

		new CloudFormation.CfnOutput(this, 'thingGroupName', {
			value: firmwareCI.thingGroupName,
			exportName: `${this.stackName}:thingGroupName`,
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
	thingGroupName: string
	bucketName: string
	userAccessKeyId: string
	userSecretAccessKey: string
}
