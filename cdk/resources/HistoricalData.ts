import * as CloudFormation from '@aws-cdk/core'
import * as S3 from '@aws-cdk/aws-s3'
import * as IAM from '@aws-cdk/aws-iam'
import * as IoT from '@aws-cdk/aws-iot'
import {
	CustomResource,
	CustomResourceProvider,
} from '@aws-cdk/aws-cloudformation'
import * as Lambda from '@aws-cdk/aws-lambda'
import { BifravstLambdas } from '../cloudformation'
import { LayeredLambdas } from '@nrfcloud/package-layered-lambdas'
import { logToCloudWatch } from './logToCloudWatch'

const WorkGroupName = 'bifravst'
const DataBaseName = 'historicaldata'

/**
 * Provides resources for historical data
 */
export class HistoricalData extends CloudFormation.Resource {
	public readonly WorkGroupName: string
	public readonly DataBaseName: string
	public readonly RawDataTableName: string
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			sourceCodeBucket,
			baseLayer,
			lambdas,
			userRole,
		}: {
			sourceCodeBucket: S3.IBucket
			baseLayer: Lambda.ILayerVersion
			lambdas: LayeredLambdas<BifravstLambdas>
			userRole: IAM.IRole
		},
	) {
		super(parent, id)

		this.WorkGroupName = WorkGroupName
		this.DataBaseName = DataBaseName

		const bucket = new S3.Bucket(this, 'bucket', {
			removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
		})

		const queryResultsBucket = new S3.Bucket(this, 'queryResults', {
			removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
		})

		const writeToResultBucket = new IAM.PolicyStatement({
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
		})

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: [
					'athena:startQueryExecution',
					'athena:stopQueryExecution',
					'athena:getQueryExecution',
					'athena:getQueryResults',
				],
			}),
		)

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: ['glue:GetTable'],
			}),
		)

		userRole.addToPolicy(
			new IAM.PolicyStatement({
				resources: [bucket.bucketArn, `${bucket.bucketArn}/*`],
				actions: ['s3:GetBucketLocation', 's3:GetObject', 's3:ListBucket'],
			}),
		)

		userRole.addToPolicy(writeToResultBucket)

		const topicRuleRole = new IAM.Role(this, 'Role', {
			assumedBy: new IAM.ServicePrincipal('iot.amazonaws.com'),
			inlinePolicies: {
				rootPermissions: new IAM.PolicyDocument({
					statements: [
						new IAM.PolicyStatement({
							actions: ['s3:PutObject'],
							resources: [`${bucket.bucketArn}/*`],
						}),
						new IAM.PolicyStatement({
							actions: ['iot:Publish'],
							resources: [
								`arn:aws:iot:${parent.account}:${parent.region}:topic/errors`,
							],
						}),
					],
				}),
			},
		})

		new IoT.CfnTopicRule(this, 'storeMessages', {
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
							bucketName: bucket.bucketName,
							key:
								'raw/updates/${parse_time("yyyy/MM/dd", timestamp())}/${parse_time("yyyyMMdd\'T\'HHmmss", timestamp())}-${clientid()}-${newuuid()}.json',
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

		// Creates the workgroup
		const lambdaDefaults = {
			layers: [baseLayer],
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_8_10,
			timeout: CloudFormation.Duration.seconds(15),
			initialPolicy: [logToCloudWatch],
		}

		const athenaDDLResourcePolicies = [
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: ['athena:startQueryExecution'],
			}),
			writeToResultBucket,
			// For managing Athena
			new IAM.PolicyStatement({
				resources: ['*'],
				actions: ['glue:*'],
			}),
		]

		const wg = new CustomResource(this, 'AthenaWorkGroup', {
			provider: CustomResourceProvider.lambda(
				new Lambda.Function(this, 'AthenaWorkGroupLambda', {
					...lambdaDefaults,
					code: Lambda.Code.bucket(
						sourceCodeBucket,
						lambdas.lambdaZipFileNames.AthenaWorkGroup,
					),
					description: 'Used in CloudFormation to create the Athena workgroup',
					initialPolicy: [
						...lambdaDefaults.initialPolicy,
						new IAM.PolicyStatement({
							resources: ['*'],
							actions: ['athena:createWorkGroup', 'athena:deleteWorkGroup'],
						}),
					],
				}),
			),
			properties: {
				WorkGroupName,
				QueryResultsBucketName: queryResultsBucket.bucketName,
			},
		})

		// Creates the database

		const db = new CustomResource(this, 'AthenaDB', {
			provider: CustomResourceProvider.lambda(
				new Lambda.Function(this, 'AthenaDBLambda', {
					...lambdaDefaults,
					code: Lambda.Code.bucket(
						sourceCodeBucket,
						lambdas.lambdaZipFileNames.AthenaDDLResource,
					),
					description: 'Used in CloudFormation to create the Athena database',
					initialPolicy: [
						...lambdaDefaults.initialPolicy,
						...athenaDDLResourcePolicies,
					],
				}),
			),
			properties: {
				WorkGroupName,
				Create: `CREATE DATABASE ${DataBaseName}`,
				Delete: `DROP DATABASE IF EXISTS ${DataBaseName} CASCADE`,
			},
		})
		db.node.addDependency(wg)

		// Create table for raw queries

		this.RawDataTableName = 'rawthingupdates2'

		new CustomResource(this, `Table${this.RawDataTableName}`, {
			provider: CustomResourceProvider.lambda(
				new Lambda.Function(this, `Table${this.RawDataTableName}Lambda`, {
					...lambdaDefaults,
					code: Lambda.Code.bucket(
						sourceCodeBucket,
						lambdas.lambdaZipFileNames.AthenaDDLResource,
					),
					description:
						'Used in CloudFormation to create the Athena table that queries raw thing updates',
					initialPolicy: [
						...lambdaDefaults.initialPolicy,
						...athenaDDLResourcePolicies,
					],
				}),
			),
			properties: {
				WorkGroupName,
				Create:
					`CREATE EXTERNAL TABLE IF NOT EXISTS ${DataBaseName}.${this.RawDataTableName} (` +
					'`reported` struct<acc:struct<ts:string, v:array<float>>, bat:struct<ts:string, v:int>, gps:struct<ts:string, v:struct<acc:float, alt:float, hdg:float, lat:float, lng:float, spd:float>>>,`timestamp` timestamp, `deviceId` string\n' +
					')' +
					"ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'\n" +
					'WITH SERDEPROPERTIES (' +
					"'serialization.format' = '1'\n" +
					`) LOCATION 's3://${bucket.bucketName}/raw/'` +
					"TBLPROPERTIES ('has_encrypted_data'='false');",
				Delete: `DROP TABLE IF EXISTS ${DataBaseName}.${this.RawDataTableName}`,
			},
		}).node.addDependency(db)
	}
}
