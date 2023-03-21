import CloudFormation from 'aws-cdk-lib'
import Cognito from 'aws-cdk-lib/aws-cognito'
import DynamoDB from 'aws-cdk-lib/aws-dynamodb'
import { WebAppCI } from '../resources/WebAppCI.js'
import { StackOutputs } from './AssetTracker/stack.js'
import { WEBAPP_CI_STACK_NAME } from './stackName.js'

export class WebAppCIStack extends CloudFormation.Stack {
	public constructor(
		parent: CloudFormation.App,
		props: {
			repository: {
				owner: string
				repo: string
			}
		},
	) {
		super(parent, WEBAPP_CI_STACK_NAME)

		new WebAppCI(this, 'webappCI', {
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
					StackOutputs.networkSurveyStorageTableArn,
				),
			),
			historicalDataTableArn: CloudFormation.Fn.importValue(
				StackOutputs.historicaldataTableArn,
			),
			repository: props.repository,
		})
	}
}
