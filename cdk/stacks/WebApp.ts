import * as CloudFormation from 'aws-cdk-lib'
import * as SSM from 'aws-cdk-lib/aws-ssm'
import { settingsPath } from '../../util/settings'
import { WebAppHosting } from '../resources/WebAppHosting'
import { StackOutputs as CoreStackOutputs } from './AssetTracker/stack'
import { WEBAPP_STACK_NAME } from './stackName'

/**
 * Defines the names use for stack outputs, which are used below to ensure
 * that the names of output variables are correct across stacks.
 */
export const StackOutputs = {
	webAppBucketName: `${WEBAPP_STACK_NAME}:webAppBucketName`,
	cloudfrontDistributionId: `${WEBAPP_STACK_NAME}:cloudfrontDistributionId`,
	webAppDomainName: `${WEBAPP_STACK_NAME}:webAppDomainName`,
} as const

const SSMParameterName = {
	webAppBucketName: 'webAppBucketName',
	cloudfrontDistributionId: 'cloudfrontDistributionId',
	webAppDomainName: 'webAppDomainName',
	fotaBucketName: 'fotaBucketName',
	geolocationApiUrl: 'geolocationApiUrl',
	historicaldataTableInfo: 'historicaldataTableInfo',
	identityPoolId: 'identityPoolId',
	ncellmeasStorageTableName: 'ncellmeasStorageTableName',
	neighborCellGeolocationApiUrl: 'neighborCellGeolocationApiUrl',
	userIotPolicyArn: 'userIotPolicyArn',
	userPoolClientId: 'userPoolClientId',
	userPoolId: 'userPoolId',
} as const

/**
 * This stack creates the resources for the web application and stores the
 * neccessary resource names in SSM so they can be queried by the user or by
 * the web app CI.
 *
 * This ensures that only the neccessary parameters are exposed
 * and that read access to CloudFormation is not neccessary for the deployment
 * of the web application. It also serves as an allowlist of parameters that
 * are exposed so that other CloudFormation outputs are not included by accident
 * in the web app's configuration.
 */
export class WebAppStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, WEBAPP_STACK_NAME)

		const webAppHosting = new WebAppHosting(this, 'webAppHosting')

		new CloudFormation.CfnOutput(this, 'webAppBucketName', {
			value: webAppHosting.bucket.bucketName,
			exportName: StackOutputs.webAppBucketName,
		})
		new CloudFormation.CfnOutput(this, 'cloudfrontDistributionId', {
			value: webAppHosting.distribution.ref,
			exportName: StackOutputs.cloudfrontDistributionId,
		})
		new CloudFormation.CfnOutput(this, 'webAppDomainName', {
			value: webAppHosting.distribution.attrDomainName,
			exportName: StackOutputs.webAppDomainName,
		})

		const ssmPrefix = settingsPath({
			stackName: this.stackName,
			system: 'stack',
			scope: 'config',
		})

		// Put web-app stack outputs in SSM
		new SSM.StringParameter(
			this,
			`${SSMParameterName.webAppBucketName}SSMParameter`,
			{
				stringValue: webAppHosting.bucket.bucketName,
				parameterName: `${ssmPrefix}/${SSMParameterName.webAppBucketName}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.cloudfrontDistributionId}SSMParameter`,
			{
				stringValue: webAppHosting.distribution.ref,
				parameterName: `${ssmPrefix}/${SSMParameterName.cloudfrontDistributionId}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.webAppDomainName}SSMParameter`,
			{
				stringValue: webAppHosting.distribution.attrDomainName,
				parameterName: `${ssmPrefix}/${SSMParameterName.webAppDomainName}`,
			},
		)

		// Put neccessary core outputs in SSM
		new SSM.StringParameter(
			this,
			`${SSMParameterName.fotaBucketName}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.fotaBucketName,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.fotaBucketName}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.geolocationApiUrl}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.geolocationApiUrl,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.geolocationApiUrl}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.historicaldataTableInfo}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.historicaldataTableInfo,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.historicaldataTableInfo}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.identityPoolId}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.identityPoolId,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.identityPoolId}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.ncellmeasStorageTableName}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.ncellmeasStorageTableName,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.ncellmeasStorageTableName}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.neighborCellGeolocationApiUrl}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.neighborCellGeolocationApiUrl,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.neighborCellGeolocationApiUrl}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.userIotPolicyArn}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.userIotPolicyArn,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.userIotPolicyArn}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.userPoolClientId}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(
					CoreStackOutputs.userPoolClientId,
				),
				parameterName: `${ssmPrefix}/${SSMParameterName.userPoolClientId}`,
			},
		)
		new SSM.StringParameter(
			this,
			`${SSMParameterName.userPoolId}SSMParameter`,
			{
				stringValue: CloudFormation.Fn.importValue(CoreStackOutputs.userPoolId),
				parameterName: `${ssmPrefix}/${SSMParameterName.userPoolId}`,
			},
		)
	}
}
