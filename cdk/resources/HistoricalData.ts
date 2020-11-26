import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as Timestream from '@aws-cdk/aws-timestream'
import { logToCloudWatch } from './logToCloudWatch'
import { LambdaLogGroup } from './LambdaLogGroup'
import { BifravstLambdas } from '../prepare-resources'
import { LambdasWithLayer } from './LambdasWithLayer'

/**
 * Provides resources for historical data
 */
export class HistoricalData extends CloudFormation.Resource {
	public readonly db: Timestream.CfnDatabase
	public readonly messagesTable: Timestream.CfnTable
	public readonly updatesTable: Timestream.CfnTable

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			userRole,
		}: {
			lambdas: LambdasWithLayer<BifravstLambdas>
			userRole: IAM.IRole
		},
	) {
		super(parent, id)

		this.db = new Timestream.CfnDatabase(this, 'db')
		this.messagesTable = new Timestream.CfnTable(this, 'messagesTable', {
			databaseName: this.db.ref,
		})
		this.updatesTable = new Timestream.CfnTable(this, 'updatesTable', {
			databaseName: this.db.ref,
		})

		// User permissions
		userRole.addToPrincipalPolicy(
			new IAM.PolicyStatement({
				resources: [this.messagesTable.attrArn, this.updatesTable.attrArn],
				actions: [
					'timestream:Select',
					'timestream:DescribeTable',
					'timestream:ListMeasures',
				],
			}),
		)
		userRole.addToPrincipalPolicy(
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: [
					'timestream:DescribeEndpoints',
					'timestream:SelectValues',
					'timestream:CancelQuery',
				],
			}),
		)

		// Store device messages
		// FIXME: CloudFormation currently does not support IoT actions for timestream, once it does (https://github.com/aws-cloudformation/aws-cloudformation-coverage-roadmap/issues/663) remove the lambda handling the message insert.

		const storeMessagesInTimestream = new Lambda.Function(this, 'lambda', {
			layers: lambdas.layers,
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
			timeout: CloudFormation.Duration.seconds(60),
			memorySize: 1792,
			code: lambdas.lambdas.storeMessagesInTimestream,
			description:
				'Processes devices messages and updates and stores them in Timestream',
			initialPolicy: [
				logToCloudWatch,
				new IAM.PolicyStatement({
					actions: ['timestream:WriteRecords'],
					resources: [this.messagesTable.attrArn, this.updatesTable.attrArn],
				}),
				new IAM.PolicyStatement({
					actions: ['timestream:DescribeEndpoints'],
					resources: ['*'],
				}),
			],
			environment: {
				MESSAGES_TABLE_NAME: this.messagesTable.ref,
				UPDATES_TABLE_NAME: this.updatesTable.ref,
				VERSION: this.node.tryGetContext('version'),
			},
		})

		new LambdaLogGroup(this, 'batchLogs', storeMessagesInTimestream)

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

		const storeUpdatesRule = new IoT.CfnTopicRule(this, 'storeUpdatesRule', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description:
					'Store all updates to thing shadow documents in Timestream',
				ruleDisabled: false,
				sql:
					"SELECT state.reported AS reported, timestamp() as timestamp, clientid() as deviceId FROM '$aws/things/+/shadow/update'",
				actions: [
					{
						lambda: {
							functionArn: storeMessagesInTimestream.functionArn,
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

		storeMessagesInTimestream.addPermission('storeUpdatesRule', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: storeUpdatesRule.attrArn,
		})

		const storeMessagesRule = new IoT.CfnTopicRule(this, 'storeMessagesRule', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Store all messages in Timestream',
				ruleDisabled: false,
				sql:
					"SELECT * as message, timestamp() as timestamp, clientid() as deviceId FROM '+/messages'",
				actions: [
					{
						lambda: {
							functionArn: storeMessagesInTimestream.functionArn,
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

		storeMessagesInTimestream.addPermission('storeMessagesRule', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: storeMessagesRule.attrArn,
		})

		const storeBatchUpdatesRule = new IoT.CfnTopicRule(
			this,
			'storeBatchUpdatesRule',
			{
				topicRulePayload: {
					awsIotSqlVersion: '2016-03-23',
					description:
						'Processes all batch messages and store them in Timestream',
					ruleDisabled: false,
					sql:
						"SELECT * as message, clientid() as deviceId, newuuid() as messageId, timestamp() as timestamp FROM '+/batch'",
					actions: [
						{
							lambda: {
								functionArn: storeMessagesInTimestream.functionArn,
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
			},
		)

		storeMessagesInTimestream.addPermission('storeBatchUpdatesRule', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: storeBatchUpdatesRule.attrArn,
		})
	}
}
