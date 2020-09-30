import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as Iot from '@aws-cdk/aws-iot'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { ThingGroup } from './ThingGroup'

export class FirmwareCI extends CloudFormation.Resource {
	public readonly thingGroupName
	public readonly resultsBucket
	public readonly userAccessKey
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			thingGroupLambda,
		}: {
			thingGroupLambda: Lambda.IFunction
		},
	) {
		super(parent, id)

		this.resultsBucket = new S3.Bucket(this, 'resultsBucket', {
			publicReadAccess: true,
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		const iotThingPolicy = new Iot.CfnPolicy(this, 'thingPolicy', {
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['iot:Connect'],
						Resource: ['arn:aws:iot:*:*:client/${iot:ClientId}'],
						Condition: {
							Bool: {
								'iot:Connection.Thing.IsAttached': [true],
							},
						},
					},
					{
						Effect: 'Allow',
						Action: ['iot:Receive'],
						Resource: ['*'],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Subscribe'],
						Resource: [
							'arn:aws:iot:*:*:topicfilter/$aws/things/${iot:ClientId}/*',
						],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: ['arn:aws:iot:*:*:topic/$aws/things/${iot:ClientId}/*'],
					},
				],
			},
		})

		this.thingGroupName = `${parent.stackName}-ci`
		new ThingGroup(this, 'ThingGroup', {
			name: this.thingGroupName,
			description: 'Group for Firmware CI',
			PolicyName: iotThingPolicy.ref,
			thingGroupLambda,
		})

		const ciUser = new IAM.User(this, 'ciUser')

		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:createThing'],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thing/firmware-ci-*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:AddThingToThingGroup'],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thinggroup/${this.thingGroupName}`,
					`arn:aws:iot:${parent.region}:${parent.account}:thing/firmware-ci-*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:CreateJob'],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thing/firmware-ci-*`,
					`arn:aws:iot:${parent.region}:${parent.account}:job/*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				resources: [`${this.resultsBucket.bucketArn}/*`],
				actions: ['s3:PutObject'],
			}),
		)

		this.userAccessKey = new IAM.CfnAccessKey(this, 'userAccessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
