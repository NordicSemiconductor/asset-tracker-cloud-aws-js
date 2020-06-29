import { CloudFormation } from 'aws-sdk'
import { stackId } from '../stacks/stackId'

const cf = new CloudFormation({
	region: process.env.AWS_DEFAULT_REGION,
})

export const getLambdaSourceCodeBucketName = async (): Promise<string> => {
	const StackName = stackId('sourcecode')
	return cf
		.describeStacks({
			StackName: StackName,
		})
		.promise()
		.then(({ Stacks }) => {
			if (Stacks === undefined || !Stacks.length) {
				throw new Error(`${StackName} stack is not available.`)
			} else {
				const stack = Stacks[0]
				const BucketOutput = stack.Outputs?.find(
					({ OutputKey }) => OutputKey === 'bucketName',
				)
				if (BucketOutput?.OutputValue === undefined) {
					throw new Error(`${StackName} bucket not found.`)
				}
				return BucketOutput.OutputValue
			}
		})
}
