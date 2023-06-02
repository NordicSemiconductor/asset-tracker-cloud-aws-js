import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import S3 from 'aws-cdk-lib/aws-s3'
import { CORE_STACK_NAME, FIRMWARE_CI_STACK_NAME } from '../stacks/stackName.js'

export class FirmwareCI extends CloudFormation.Resource {
	public readonly bucket
	public readonly userAccessKey
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{ jitpRole }: { jitpRole: IAM.IRole },
	) {
		super(parent, id)

		this.bucket = new S3.Bucket(this, 'bucket', {
			publicReadAccess: true,
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
			blockPublicAccess: {
				blockPublicAcls: false,
				ignorePublicAcls: false,
				restrictPublicBuckets: false,
				blockPublicPolicy: false,
			},
			objectOwnership: S3.ObjectOwnership.OBJECT_WRITER,
		})

		const ciUser = new IAM.User(this, 'ciUser')

		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateThing',
					'iot:AddThingToThingGroup',
					'iot:RemoveThingFromThingGroup',
					'iot:AttachThingPrincipal',
					'iot:DetachThingPrincipal',
					'iot:CreateJob',
					'iot:DescribeJobExecution',
				],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thing/firmware-ci-*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateKeysAndCertificate',
					'iot:DeleteCertificate',
					'iot:UpdateCertificate',
					'iot:AttachThingPrincipal',
					'iot:DetachThingPrincipal',
					'iot:DescribeThing',
					'iot:GetThingShadow',
					'iot:CreateJob',
					'iot:DescribeEndpoint',
					'iot:GetRegistrationCode',
					'iot:UpdateEventConfigurations',
					'iot:RegisterCACertificate',
					'iot:ListThingPrincipals',
					'iot:DeleteThing',
					'iot:TagResource',
				],
				resources: [`*`],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iam:PassRole'],
				resources: [jitpRole.roleArn],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateJob',
					'iot:CancelJob',
					'iot:DeleteJob',
					'iot:DescribeJob',
					'iot:DescribeJobExecution',
					'iot:GetJobDocument',
				],
				resources: [`arn:aws:iot:${parent.region}:${parent.account}:job/*`],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				resources: [`${this.bucket.bucketArn}/*`],
				actions: ['s3:PutObject', 's3:DeleteObject'],
			}),
		)

		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				resources: [
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${FIRMWARE_CI_STACK_NAME}/*`,
					`arn:aws:cloudformation:${this.stack.region}:${this.stack.account}:stack/${CORE_STACK_NAME}/*`,
				],
				actions: ['cloudformation:DescribeStacks'],
			}),
		)

		this.userAccessKey = new IAM.CfnAccessKey(this, 'userAccessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
