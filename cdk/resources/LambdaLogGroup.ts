import * as CloudFormation from 'aws-cdk-lib'
import { aws_lambda as Lambda } from 'aws-cdk-lib'
import { aws_logs as CloudWatchLogs } from 'aws-cdk-lib'
import { Construct } from 'constructs'

export class LambdaLogGroup extends CloudFormation.Resource {
	public constructor(parent: Construct, id: string, lambda: Lambda.IFunction) {
		super(parent, id)
		const isTest = this.node.tryGetContext('isTest') === true
		new CloudWatchLogs.LogGroup(this, 'LogGroup', {
			removalPolicy: isTest
				? CloudFormation.RemovalPolicy.DESTROY
				: CloudFormation.RemovalPolicy.RETAIN,
			logGroupName: `/aws/lambda/${lambda.functionName}`,
			retention: isTest
				? CloudWatchLogs.RetentionDays.ONE_DAY
				: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})
	}
}
