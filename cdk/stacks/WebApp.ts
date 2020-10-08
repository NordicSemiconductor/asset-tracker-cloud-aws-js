import * as CloudFormation from '@aws-cdk/core'
import { WebAppHosting } from '../resources/WebAppHosting'
import { WEBAPP_STACK_NAME } from './stackName'

export class WebAppStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, WEBAPP_STACK_NAME)

		const webAppHosting = new WebAppHosting(this, 'webAppHosting')
		new CloudFormation.CfnOutput(this, 'webAppBucketName', {
			value: webAppHosting.bucket.bucketName,
			exportName: `${this.stackName}:webAppBucketName`,
		})

		new CloudFormation.CfnOutput(this, 'cloudfrontDistributionIdWebApp', {
			value: webAppHosting.distribution.ref,
			exportName: `${this.stackName}:cloudfrontDistributionIdWebApp`,
		})

		new CloudFormation.CfnOutput(this, 'webAppDomainName', {
			value: webAppHosting.distribution.attrDomainName,
			exportName: `${this.stackName}:webAppDomainName`,
		})
	}
}
