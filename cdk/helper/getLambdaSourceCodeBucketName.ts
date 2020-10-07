import { CloudFormation } from 'aws-sdk'
import { SOURCECODE_STACK_NAME } from '../stacks/stackName'

const cf = new CloudFormation({
	region: process.env.AWS_DEFAULT_REGION,
})

export const getLambdaSourceCodeBucketName = async (): Promise<string> => {
	const StackName = SOURCECODE_STACK_NAME
	return cf
		.describeStacks({
			StackName: StackName,
		})
		.promise()
		.then(({ Stacks }) => {
			if (Stacks === null || Stacks === undefined || !Stacks.length) {
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
