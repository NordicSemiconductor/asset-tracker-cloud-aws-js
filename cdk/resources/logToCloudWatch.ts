import IAM from 'aws-cdk-lib/aws-iam'

export const logToCloudWatch = new IAM.PolicyStatement({
	resources: ['*'],
	actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
})
