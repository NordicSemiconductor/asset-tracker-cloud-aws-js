import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'

export class LambdaLogGroup extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Construct,
		id: string,
		{ lambda }: { lambda: Lambda.Function },
	) {
		super(parent, id)

		new CloudWatchLogs.LogGroup(this, 'LogGroup', {
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
			logGroupName: `/aws/lambda/${lambda.functionName}`,
			retention: CloudWatchLogs.RetentionDays.ONE_WEEK,
		})
	}
}
