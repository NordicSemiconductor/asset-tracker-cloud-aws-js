import { aws_iam as IAM } from 'aws-cdk-lib'

export const logToCloudWatch = new IAM.PolicyStatement({
	resources: ['*'],
	actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
})
