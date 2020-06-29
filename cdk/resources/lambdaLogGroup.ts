import * as CloudFormation from '@aws-cdk/core'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as CloudWatchLogs from '@aws-cdk/aws-logs'

export const lambdaLogGroup = (
	parent: CloudFormation.Construct,
	functionName: string,
	lambda: Lambda.IFunction,
): CloudWatchLogs.LogGroup =>
	new CloudWatchLogs.LogGroup(parent, `${functionName}LogGroup`, {
		removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		logGroupName: `/aws/lambda/${lambda.functionName}`,
		retention: CloudWatchLogs.RetentionDays.ONE_WEEK,
	})
