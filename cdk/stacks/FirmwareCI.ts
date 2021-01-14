import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { FirmwareCI } from '../resources/FirmwareCI.js'
import { ThingGroupLambda } from '../resources/ThingGroupLambda.js'
import { CDKLambdas, PackedLambdas } from '../prepare-resources.js'
import { FIRMWARE_CI_STACK_NAME } from './stackName.js'
import { lambdasOnS3 } from '../resources/lambdasOnS3.js'

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
				compatibleRuntimes: [Lambda.Runtime.NODEJS_12_X],
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
