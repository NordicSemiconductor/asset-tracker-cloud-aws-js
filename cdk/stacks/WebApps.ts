import * as CloudFormation from '@aws-cdk/core'
import { WebAppHosting } from '../resources/WebAppHosting'

export class WebAppsStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App, id: string) {
		super(parent, id)

		// Web App

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

		// Device UI

		const deviceUIHosting = new WebAppHosting(this, 'deviceUIHosting')
		new CloudFormation.CfnOutput(this, 'deviceUiBucketName', {
			value: deviceUIHosting.bucket.bucketName,
			exportName: `${this.stackName}:deviceUi`,
		})

		new CloudFormation.CfnOutput(this, 'cloudfrontDistributionIdDeviceUi', {
			value: deviceUIHosting.distribution.ref,
			exportName: `${this.stackName}:cloudfrontDistributionIdDeviceUi`,
		})

		new CloudFormation.CfnOutput(this, 'deviceUiDomainName', {
			value: deviceUIHosting.distribution.attrDomainName,
			exportName: `${this.stackName}:deviceUiDomainName`,
		})
	}
}
