import * as IAM from '@aws-cdk/aws-iam'

export const logToCloudWatch = new IAM.PolicyStatement({
	resources: ['*'],
	actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
})
