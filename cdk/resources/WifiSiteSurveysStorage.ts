import * as CloudFormation from 'aws-cdk-lib'
import * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as IoT from 'aws-cdk-lib/aws-iot'

/**
 * Provides storage for WiFi site surveys
 *
 * The result of a WiFi site survey is too large to be put in the AWS shadow (which is limited to 4k).
 *
 * Therefore devices publish WiFi site surveys on the topic <deviceId>/wifiap.
 *
 * These survey are then stored in DynamoDB for retrieval by the app.
 */
export class WifiSiteSurveysStorage extends CloudFormation.Resource {
	public readonly surveysTable: DynamoDB.Table

	public constructor(parent: CloudFormation.Stack, id: string) {
		super(parent, id)

		const isTest = this.node.tryGetContext('isTest') === true

		this.surveysTable = new DynamoDB.Table(this, 'table', {
			billingMode: DynamoDB.BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'surveyId',
				type: DynamoDB.AttributeType.STRING,
			},
			pointInTimeRecovery: !isTest,
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
			stream: DynamoDB.StreamViewType.NEW_IMAGE,
			timeToLiveAttribute: 'ttl',
		})

		this.surveysTable.addGlobalSecondaryIndex({
			indexName: 'surveyByDevice',
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
					],
				}),
			},
		})
		this.surveysTable.grantWriteData(topicRuleRole)

		new IoT.CfnTopicRule(this, 'storeSurvey', {
			topicRulePayload: {
				awsIotSqlVersion: '2016-03-23',
				description: 'Store all WiFi site surveys sent by devices in DynamoDB',
				ruleDisabled: false,
				sql: [
					`SELECT newuuid() as surveyId,`,
					`clientid() as deviceId,`,
					`parse_time("yyyy-MM-dd'T'HH:mm:ss.S'Z'", timestamp()) as timestamp,`,
					`* as survey,`,
					// Delete survey after 30 days
					`floor(timestamp() / 1000) + 2592000 as ttl`,
					`FROM '+/wifiap'`,
				].join(' '),
				actions: [
					{
						dynamoDBv2: {
							putItem: {
								tableName: this.surveysTable.tableName,
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
