import * as CloudFormation from 'aws-cdk-lib'
import * as Cognito from 'aws-cdk-lib/aws-cognito'
import * as DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import { WebAppCI } from '../resources/WebAppCI'
import { StackOutputs } from './AssetTracker/stack'
import { WEBAPP_CI_STACK_NAME } from './stackName'

export class WebAppCIStack extends CloudFormation.Stack {
	public constructor(parent: CloudFormation.App) {
		super(parent, WEBAPP_CI_STACK_NAME)

		const webappCI = new WebAppCI(this, 'webappCI', {
			userPool: Cognito.UserPool.fromUserPoolArn(
				this,
				'userPoolArn',
				CloudFormation.Fn.importValue(StackOutputs.userPoolArn),
			),
			cellGeoLocationCacheTable: DynamoDB.Table.fromTableArn(
				this,
				'cellGeoLocationCacheTable',
				CloudFormation.Fn.importValue(
					StackOutputs.cellGeolocationCacheTableArn,
				),
			),
			networksurveyStorageTable: DynamoDB.Table.fromTableArn(
				this,
				'networksurveyStorageTable',
				CloudFormation.Fn.importValue(
					StackOutputs.networksurveyStorageTableArn,
				),
			),
			historicalDataTableArn: CloudFormation.Fn.importValue(
				StackOutputs.historicaldataTableArn,
			),
		})

		new CloudFormation.CfnOutput(this, 'userAccessKeyId', {
			value: webappCI.userAccessKey.ref,
			exportName: `${this.stackName}:userAccessKeyId`,
		})

		new CloudFormation.CfnOutput(this, 'userSecretAccessKey', {
			value: webappCI.userAccessKey.attrSecretAccessKey,
			exportName: `${this.stackName}:userSecretAccessKey`,
		})
	}
}

export type StackOutputs = {
	userAccessKeyId: string
	userSecretAccessKey: string
}
