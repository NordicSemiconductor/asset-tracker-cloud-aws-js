import * as CloudFormation from 'aws-cdk-lib'
import * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as IoT from 'aws-cdk-lib/aws-iot'

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

		this.reportsTable = new DynamoDB.Table(this, 'reportsTable', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'reportId',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: true,
			removalPolicy:
				this.node.tryGetContext('isTest') === true
					? CloudFormation.RemovalPolicy.DESTROY
					: CloudFormation.RemovalPolicy.RETAIN,
			stream: DynamoDB.StreamViewType.NEW_IMAGE,
			timeToLiveAttribute: 'ttl',
		})

		this.reportsTable.addGlobalSecondaryIndex({
			indexName: 'reportByDevice',
			partitionKey: {
				name: 'deviceId',
				type: DynamoDB.AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: DynamoDB.AttributeType.STRING,
			},
			projectionType: DynamoDB.ProjectionType.KEYS_ONLY,
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
						new IAM.PolicyStatement({
							actions: ['iot:GetThingShadow'],
							resources: ['*'],
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
				sql: `SELECT newuuid() as reportId, clientid() as deviceId, parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as timestamp, * as report, get_thing_shadow(clientid(), "${topicRuleRole.roleArn}").state.reported.roam.v.nw as nw FROM '+/ncellmeas'`,
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
