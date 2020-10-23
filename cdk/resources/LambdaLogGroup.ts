import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'

export class LambdaLogGroup extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Construct,
		id: string,
		lambda: Lambda.IFunction,
	) {
		super(parent, id)
		new CloudWatchLogs.LogGroup(parent, `LogGroup`, {
			removalPolicy: CloudFormation.RemovalPolicy.RETAIN,
			logGroupName: `/aws/lambda/${lambda.functionName}`,
			retention:
				this.node.tryGetContext('isTest') === true
					? CloudWatchLogs.RetentionDays.ONE_DAY
					: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})
	}
}
