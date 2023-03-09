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

		const SSMParameters: Record<string, string> = {
			webAppBucketName: webAppHosting.bucket.bucketName,
			cloudfrontDistributionId: webAppHosting.distribution.ref,
			webAppDomainName: webAppHosting.distribution.attrDomainName,
			fotaBucketName: CloudFormation.Fn.importValue(
				CoreStackOutputs.fotaBucketName,
			),
			geolocationApiUrl: CloudFormation.Fn.importValue(
				CoreStackOutputs.geolocationApiUrl,
			),
			historicaldataTableInfo: CloudFormation.Fn.importValue(
				CoreStackOutputs.historicaldataTableInfo,
			),
			identityPoolId: CloudFormation.Fn.importValue(
				CoreStackOutputs.identityPoolId,
			),
			networksurveyStorageTableName: CloudFormation.Fn.importValue(
				CoreStackOutputs.networksurveyStorageTableName,
			),
			userIotPolicyName: CloudFormation.Fn.importValue(
				CoreStackOutputs.userIotPolicyName,
			),
			userPoolClientId: CloudFormation.Fn.importValue(
				CoreStackOutputs.userPoolClientId,
			),
			userPoolId: CloudFormation.Fn.importValue(CoreStackOutputs.userPoolId),
			cellGeoLocationCacheTableName: CloudFormation.Fn.importValue(
				CoreStackOutputs.cellGeolocationCacheTableName,
			),
		}

		for (const k of Object.keys(SSMParameters)) {
			new SSM.StringParameter(this, `${k}SSMParameter`, {
				stringValue: SSMParameters[k],
				parameterName: `${ssmPrefix}/${k}`,
			})
		}
	}
}
