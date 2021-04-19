import CloudFormation from '@aws-cdk/core'
import Lambda from '@aws-cdk/aws-lambda'
import CloudWatchLogs from '@aws-cdk/aws-logs'

export class LambdaLogGroup extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Construct,
		id: string,
		lambda: Lambda.IFunction,
	) {
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
