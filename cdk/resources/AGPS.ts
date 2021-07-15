import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as Lambda from '@aws-cdk/aws-lambda'
import { iotRuleSqlCheckUndefined } from '../helper/iotRuleSqlCheckUndefined'
import * as SQS from '@aws-cdk/aws-sqs'
import { Duration } from '@aws-cdk/core'
import * as StepFunctions from '@aws-cdk/aws-stepfunctions'

/**
 * Provides assisted GPS data to devices via MQTT.
 */
export class AGPS extends CloudFormation.Resource {
	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		const topicRuleRole = new IAM.Role(this, 'topicRule', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${parent.region}:${parent.account}:topic/errors`,
							],
						}),
					],
				}),
			},
		})

		const queue = new SQS.Queue(this, 'queue', {
			retentionPeriod: Duration.minutes(10),
		})
		queue.grantSendMessages(topicRuleRole)

		new IoT.CfnTopicRule(this, 'deviceAGPSRequestRule', {
			topicRulePayload: {
				description:
					'Devices request A-GPS data by publishing the the AWS IoT topic <deviceId>/agps/get. This puts all requests in a queue so we can resolved the requested data, but also ensure that we do not hit the third part APIs if many devices request the same location data at once (cargo container scenario).',
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: `SELECT mcc, mnc, cell, area, phycell, types, clientid() as deviceId, parse_time(\"yyyy-MM-dd'T'HH:mm:ss.S'Z'\", timestamp()) as timestamp from FROM '+/agps/get' WHERE ${iotRuleSqlCheckUndefined(
					['mcc', 'mnc', 'cell', 'area', 'types'], // phycell is optional
				)}`,
				actions: [
					{
						sqs: {
							queueUrl: queue.queueUrl,
							roleArn: topicRuleRole.roleArn,
							useBase64: false,
						},
					},
				],
				errorAction: {
					republish: {
						roleArn: topicRuleRole.roleArn,
						topic: 'errors',
					},
				},
			},
		})

		const deviceRequestHandler = new Lambda.Function(
			this,
			'deviceRequestHandler',
			{
				runtime: Lambda.Runtime.NODEJS_14_X,
			},
		)
		deviceRequestHandler.grantInvoke(topicRuleRole)
	}
}
