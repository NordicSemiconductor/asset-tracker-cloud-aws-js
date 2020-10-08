import * as CloudFormation from '@aws-cdk/core'
import { WebAppHosting } from '../resources/WebAppHosting'
import { DEVICEUI_STACK_NAME } from './stackName'

export class DeviceUIStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, DEVICEUI_STACK_NAME)

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
