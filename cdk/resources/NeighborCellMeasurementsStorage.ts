import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as DynamoDB from '@aws-cdk/aws-dynamodb'

/**
 * Provides storage for neighboring cell measurement reports
 *
 * The result of the AT command %NCELLMEAS is too large to be put in the AWS shadow (which is limited to 4k).
 *
 * Therefore devices publish neighboring cell measurement reports on the topic <deviceId>/ncellmeas.
 *
 * These reports are then stored in DynamoDB for retrieval by the app.
 *
 * @see https://infocenter.nordicsemi.com/topic/ref_at_commands/REF/at_commands/mob_termination_ctrl_status/ncellmeas.html
 */
export class NeighborCellMeasurementsStorage extends CloudFormation.Resource {
	public readonly reportsTable: DynamoDB.Table

	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		this.reportsTable = new DynamoDB.Table(this, 'reports', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'deviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy:
				this.node.tryGetContext('isTest') === true
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
			timeToLiveAttribute: 'ttl',
		})

		const topicRuleRole = new IAM.Role(this, 'Role', {
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
		this.reportsTable.grantWriteData(topicRuleRole)

		new IoT.CfnTopicRule(this, 'storeReports', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description:
					'Store all neighboring cell measurement reports sent by devices in DynamoDB',
				ruleDisabled: false,
				sql: "SELECT * as report, clientid() as deviceId, timestamp() as timestamp FROM '+/ncellmeas'",
				actions: [
					{
						dynamoDBv2: {
							putItem: {
								tableName: this.reportsTable.tableName,
							},
							roleArn: topicRuleRole.roleArn,
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
	}
}
