import { CloudFormation } from 'aws-sdk'

export const toObject = (output: CloudFormation.Output[]) =>
	output.reduce(
		(env, { OutputKey, OutputValue }) => ({
			...env,
			[`${OutputKey}`]: `${OutputValue}`,
		}),
		{} as { [key: string]: string },
	)
