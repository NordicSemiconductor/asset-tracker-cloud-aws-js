import CloudFormation from 'aws-cdk-lib'
import IAM from 'aws-cdk-lib/aws-iam'
import IoT from 'aws-cdk-lib/aws-iot'
import Lambda from 'aws-cdk-lib/aws-lambda'
import Timestream from 'aws-cdk-lib/aws-timestream'
import type { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import Logs from 'aws-cdk-lib/aws-logs'

/**
 * Provides resources for historical data
 */
export class HistoricalData extends CloudFormation.Resource {
	public readonly table: Timestream.CfnTable

	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			userRole,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas['lambdas']>
			userRole: IAM.IRole
		},
	) {
		super(parent, id)

		const db = new Timestream.CfnDatabase(this, 'db')
		this.table = new Timestream.CfnTable(this, 'table', {
			databaseName: db.ref,
			retentionProperties: {
				MemoryStoreRetentionPeriodInHours: '24',
				MagneticStoreRetentionPeriodInDays: '365',
			},
		})

		// User permissions
		userRole.addToPrincipalPolicy(
			new IAM.PolicyStatement({
				resources: [this.table.attrArn],
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
			handler: lambdas.lambdas.storeMessagesInTimestream.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_20_X,
			timeout: CloudFormation.Duration.minutes(2),
			memorySize: 1792,
			code: Lambda.Code.fromAsset(
				lambdas.lambdas.storeMessagesInTimestream.zipFile,
			),
			description:
				'Processes devices messages and updates and stores them in Timestream',
			initialPolicy: [
				new IAM.PolicyStatement({
					actions: ['timestream:WriteRecords'],
					resources: [this.table.attrArn],
				}),
				new IAM.PolicyStatement({
					actions: ['timestream:DescribeEndpoints'],
					resources: ['*'],
				}),
			],
			environment: {
				TABLE_INFO: this.table.ref,
				VERSION: this.node.tryGetContext('version'),
				STACK_NAME: this.stack.stackName,
			},
			logRetention: Logs.RetentionDays.ONE_WEEK,
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

		const storeUpdatesRule = new IoT.CfnTopicRule(this, 'storeUpdatesRule', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description:
					'Store all updates to thing shadow documents in Timestream',
				ruleDisabled: false,
				sql: "SELECT state.reported AS reported, clientid() as deviceId FROM '$aws/things/+/shadow/update'",
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
				sql: "SELECT * as message, clientid() as deviceId FROM '+/messages'",
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
					sql: "SELECT * as batch, clientid() as deviceId FROM '+/batch'",
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
