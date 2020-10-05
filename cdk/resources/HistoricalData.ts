import * as CloudFormation from '@aws-cdk/core'
import * as S3 from '@aws-cdk/aws-s3'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as Events from '@aws-cdk/aws-events'
import * as EventTargets from '@aws-cdk/aws-events-targets'
import * as Lambda from '@aws-cdk/aws-lambda'
import { logToCloudWatch } from './logToCloudWatch'
import { lambdaLogGroup } from './lambdaLogGroup'
import { BifravstLambdas } from '../prepare-resources'
import { LambdasWithLayer } from './LambdasWithLayer'

export const permissions = ({
	historicalData,
}: {
	historicalData: HistoricalData
}): IAM.PolicyStatement[] => {
	const dataBucket = historicalData.dataBucket
	const queryResultsBucket = historicalData.queryResultsBucket

	return [
		new IAM.PolicyStatement({
			resources: ['*'],
			actions: [
				'athena:startQueryExecution',
				'athena:stopQueryExecution',
				'athena:getQueryExecution',
				'athena:getQueryResults',
				'glue:GetTable',
				'glue:GetDatabase',
			],
		}),
		// Users need to read from data bucket
		new IAM.PolicyStatement({
			resources: [dataBucket.bucketArn, `${dataBucket.bucketArn}/*`],
			actions: [
				's3:GetBucketLocation',
				's3:GetObject',
				's3:ListBucket',
				's3:ListBucketMultipartUploads',
				's3:ListMultipartUploadParts',
			],
		}),

		new IAM.PolicyStatement({
			resources: [
				queryResultsBucket.bucketArn,
				`${queryResultsBucket.bucketArn}/*`,
			],
			actions: [
				's3:GetBucketLocation',
				's3:GetObject',
				's3:ListBucket',
				's3:ListBucketMultipartUploads',
				's3:ListMultipartUploadParts',
				's3:AbortMultipartUpload',
				's3:PutObject',
			],
		}),
		new IAM.PolicyStatement({
			resources: [dataBucket.bucketArn, `${dataBucket.bucketArn}/*`],
			actions: ['s3:GetBucketLocation', 's3:GetObject', 's3:ListBucket'],
		}),
		// Users need to be able to write to the results bucket
		new IAM.PolicyStatement({
			resources: [
				queryResultsBucket.bucketArn,
				`${queryResultsBucket.bucketArn}/*`,
			],
			actions: [
				's3:GetBucketLocation',
				's3:GetObject',
				's3:ListBucket',
				's3:ListBucketMultipartUploads',
				's3:ListMultipartUploadParts',
				's3:AbortMultipartUpload',
				's3:PutObject',
			],
		}),
	]
}

/**
 * Provides resources for historical data
 */
export class HistoricalData extends CloudFormation.Resource {
	public readonly dataBucket: S3.IBucket
	public readonly queryResultsBucket: S3.IBucket
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			userRole,
			isTest,
		}: {
			lambdas: LambdasWithLayer<BifravstLambdas>
			userRole: IAM.IRole
			isTest: boolean
		},
	) {
		super(parent, id)

		this.dataBucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
		})

		this.queryResultsBucket = new S3.Bucket(this, 'queryResults', {
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		const topicRuleRole = new IAM.Role(this, 'Role', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['s3:PutObject'],
							resources: [`${this.dataBucket.bucketArn}/*`],
						}),
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

		new IoT.CfnTopicRule(this, 'storeUpdates', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Store all updates to thing shadow documents on S3',
				ruleDisabled: false,
				// Note: this timestamp is formatted for the AWS Athena TIMESTAMP datatype
				sql:
					'SELECT state.reported AS reported, parse_time("yyyy-MM-dd HH:mm:ss.S", timestamp()) as timestamp, clientid() as deviceId FROM \'$aws/things/+/shadow/update\'',
				actions: [
					{
						s3: {
							bucketName: this.dataBucket.bucketName,
							key:
								'updates/raw/${parse_time("yyyy/MM/dd", timestamp())}/${parse_time("yyyyMMdd\'T\'HHmmss", timestamp())}-${regexp_replace(clientid(), "/", "")}-${newuuid()}.json',
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

		new IoT.CfnTopicRule(this, 'storeMessages', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Store all messages on S3',
				ruleDisabled: false,
				// Note: this timestamp is formatted for the AWS Athena TIMESTAMP datatype
				sql:
					'SELECT * as message, parse_time("yyyy-MM-dd HH:mm:ss.S", timestamp()) as timestamp, clientid() as deviceId FROM \'+/messages\'',
				actions: [
					{
						s3: {
							bucketName: this.dataBucket.bucketName,
							key:
								'updates/raw/${parse_time("yyyy/MM/dd", timestamp())}/${parse_time("yyyyMMdd\'T\'HHmmss", timestamp())}-${regexp_replace(clientid(), "/", "")}-${newuuid()}.json',
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

		// Batch messages

		const processBatchMessages = new Lambda.Function(
			this,
			'processBatchMessages',
			{
				layers: lambdas.layers,
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(10),
				memorySize: 1792,
				code: lambdas.lambdas.processBatchMessages,
				description: 'Processes batch messages and stores them on S3',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						resources: [
							this.dataBucket.bucketArn,
							`${this.dataBucket.bucketArn}/*`,
						],
						actions: [
							's3:ListBucket',
							's3:GetObject',
							's3:PutObject',
							's3:DeleteObject',
						],
					}),
				],
				environment: {
					HISTORICAL_DATA_BUCKET: this.dataBucket.bucketName,
				},
				reservedConcurrentExecutions: 1,
			},
		)

		lambdaLogGroup(this, 'processBatchMessages', processBatchMessages)

		const processBatchMessagesRule = new IoT.CfnTopicRule(
			this,
			'processBatchMessagesIotRule',
			{
				topicRulePayload: {
					awsIotSqlVersion: '2016-03-23',
					description: 'Processes all batch messages and stores them on S3',
					ruleDisabled: false,
					sql:
						"SELECT * as message, clientid() as deviceId, newuuid() as messageId, timestamp() as timestamp FROM '+/batch'",
					actions: [
						{
							lambda: {
								functionArn: processBatchMessages.functionArn,
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

		processBatchMessages.addPermission('processBatchMessagesInvokeByIot', {
			principal: new IAM.ServicePrincipal('iot.amazonaws.com'),
			sourceArn: processBatchMessagesRule.attrArn,
		})

		// Concatenate the log files

		const concatenateRawMessages = new Lambda.Function(
			this,
			'concatenateRawMessages',
			{
				layers: lambdas.layers,
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_12_X,
				timeout: CloudFormation.Duration.seconds(900),
				memorySize: 1792,
				code: lambdas.lambdas.concatenateRawMessages,
				description:
					'Runs every hour and concatenates the raw device messages so it is more performant for Athena to query them.',
				initialPolicy: [
					logToCloudWatch,
					new IAM.PolicyStatement({
						resources: [
							this.dataBucket.bucketArn,
							`${this.dataBucket.bucketArn}/*`,
						],
						actions: [
							's3:ListBucket',
							's3:GetObject',
							's3:PutObject',
							's3:DeleteObject',
						],
					}),
				],
				environment: {
					HISTORICAL_DATA_BUCKET: this.dataBucket.bucketName,
				},
				reservedConcurrentExecutions: 1,
			},
		)

		lambdaLogGroup(this, 'concatenateRawMessages', concatenateRawMessages)

		const rule = new Events.Rule(this, 'invokeConcatenateRawMessagesRule', {
			schedule: Events.Schedule.expression('rate(1 hour)'),
			description:
				'Invoke the lambda which concatenates the raw device messages',
			enabled: true,
			targets: [new EventTargets.LambdaFunction(concatenateRawMessages)],
		})

		concatenateRawMessages.addPermission('InvokeByEvents', {
			principal: new IAM.ServicePrincipal('events.amazonaws.com'),
			sourceArn: rule.ruleArn,
		})

		// User permissions
		permissions({ historicalData: this }).forEach((policy) =>
			userRole.addToPolicy(policy),
		)
	}
}
