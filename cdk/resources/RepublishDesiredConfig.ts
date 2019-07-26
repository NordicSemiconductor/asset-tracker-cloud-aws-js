import * as CloudFormation from '@aws-cdk/core'
import * as IoT from '@aws-cdk/aws-iot'
import * as IAM from '@aws-cdk/aws-iam'

/**
 * This sets up the rules to republish the desired config
 * because the nRF9160 cannot handle messages larger than 2303 bytes.
 */
export class RepublishDesiredConfig extends CloudFormation.Resource {
	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		const topicSuffix = 'desired/cfg'

		const role = new IAM.Role(this, 'Role', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${parent.account}:${parent.region}:topic/$aws/things/*/shadow/get/accepted/${topicSuffix}`,
							],
						}),
					],
				}),
			},
		})

		new IoT.CfnTopicRule(this, 'republishConfig', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description:
					'republishes the desired config part of the device shadow on a sub topic to reduce message size',
				ruleDisabled: false,
				sql: `SELECT state.desired.cfg AS cfg FROM '$aws/things/+/shadow/get/accepted'`,
				actions: [
					{
						republish: {
							roleArn: role.roleArn,
							topic: `\${topic()}/${topicSuffix}`,
						},
					},
				],
			},
		})
	}
}
