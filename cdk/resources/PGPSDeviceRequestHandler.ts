import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import * as SQS from '@aws-cdk/aws-sqs'
import { Duration } from '@aws-cdk/core'
import { LambdasWithLayer } from './LambdasWithLayer'
import { AssetTrackerLambdas } from '../stacks/AssetTracker/lambdas'
import * as Lambda from '@aws-cdk/aws-lambda'
import { LambdaLogGroup } from './LambdaLogGroup'
import { PGPSResolver } from './PGPSResolver'
import { PGPSStorage } from './PGPSStorage'
import { PolicyStatement } from '@aws-cdk/aws-iam'
import { iotRuleSqlCheckIfDefinedAndNotZero } from '../helper/iotRuleSqlCheckIfDefinedAndNotZero'

export const MAX_RESOLUTION_TIME_IN_MINUTES = 10

/**
 * Provides predicted GPS data to devices via MQTT.
 *
 * This implementation prevents hammering the third-party API by queuing all
 * device requests and using the execution ID of StepFunctions ensure that the
 * same request from multiple devices is only resolved once.
 *
 * I works like this:
 *   • put all device requests in a queue
 *   • call lambda from queue, check if request is resolved (data is in DynamoDB)
 *   • if yes, publish MQTT message and remove task from queue
 *   • if no
 *     • start step function to resolve request, using request + timestamp
 *       binned to hour as execution ID (so it's only executed once)
 *     • persist a temporary entry in the cache table so other items won't try to start execution as well
 *     • return item to queue (which will later call the lambda again with the item)
 */
export class PGPSDeviceRequestHandler extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			lambdas,
			storage,
			resolver,
		}: {
			lambdas: LambdasWithLayer<AssetTrackerLambdas>
			storage: PGPSStorage
			resolver: PGPSResolver
		},
	) {
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
			retentionPeriod: Duration.minutes(MAX_RESOLUTION_TIME_IN_MINUTES),
			visibilityTimeout: Duration.minutes(1),
		})
		queue.grantSendMessages(topicRuleRole)

		new IoT.CfnTopicRule(this, 'devicePGPSRequestRule', {
			topicRulePayload: {
				description:
					'Devices request P-GPS data by publishing the the AWS IoT topic <deviceId>/pgps/get. This puts all requests in a queue so we can resolved the requested data, but also ensure that we do not hit the third part APIs if many devices request the same prediction data at once (cargo container scenario).',
				ruleDisabled: false,
				awsIotSqlVersion: '2016-03-23',
				sql: `SELECT n, int, day, time, clientid() as deviceId, parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as timestamp FROM '+/pgps/get' WHERE ${iotRuleSqlCheckIfDefinedAndNotZero(
					['n', 'int', 'day', 'time'], // all message properties are optional positive integers
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
				layers: lambdas.layers,
				handler: 'index.handler',
				runtime: Lambda.Runtime.NODEJS_14_X,
				timeout: CloudFormation.Duration.minutes(1),
				memorySize: 1792,
				code: lambdas.lambdas.pgpsDeviceRequestHandler,
				description:
					'Handles P-GPS requests which have been queued, either by fullfilling them by using the resolved data, or by starting a new resolution',
				environment: {
					CACHE_TABLE: storage.cacheTable.tableName,
					VERSION: this.node.tryGetContext('version'),
					STACK_NAME: this.stack.stackName,
					BIN_HOURS: '1',
					STATE_MACHINE_ARN: resolver.stateMachine.stateMachineArn,
					QUEUE_URL: queue.queueUrl,
					MAX_RESOLUTION_TIME_IN_MINUTES: `${MAX_RESOLUTION_TIME_IN_MINUTES}`,
				},
				initialPolicy: [
					new PolicyStatement({
						actions: ['iot:Publish'],
						resources: [
							`arn:aws:iot:${parent.region}:${parent.account}:topic/*/pgps`,
						],
					}),
				],
			},
		)

		new LambdaLogGroup(this, 'deviceRequestHandlerLogs', deviceRequestHandler)

		// Invoke lambda for all P-GPS requests from devices
		new Lambda.EventSourceMapping(this, 'invokeLambdaFromNotificationQueue', {
			eventSourceArn: queue.queueArn,
			target: deviceRequestHandler,
			batchSize: 10,
		})
		deviceRequestHandler.addPermission('invokeBySQS', {
			principal: new IAM.ServicePrincipal('sqs.amazonaws.com'),
			sourceArn: queue.queueArn,
		})
		queue.grantConsumeMessages(deviceRequestHandler)

		// If not yet fullfilled, execute this step function
		resolver.stateMachine.grantStartExecution(deviceRequestHandler)

		// Allow lambda to read from the cache table to fullfill already resolved requests
		// ... and write execution ID to cache table
		storage.cacheTable.grantReadWriteData(deviceRequestHandler)

		// Allow lambda to republish unfullfilled requests
		queue.grantSendMessages(deviceRequestHandler)
	}
}
