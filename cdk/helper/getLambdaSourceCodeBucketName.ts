import { CloudFormation } from 'aws-sdk'
import { stackId } from '../stacks/LambdaSourceCodeStorage'

const cf = new CloudFormation({
	region: process.env.AWS_DEFAULT_REGION,
})

export const getLambdaSourceCodeBucketName = async ({
	bifravstStackName,
}: {
	bifravstStackName: string
}): Promise<string> =>
	cf
		.describeStacks({
			StackName: stackId({ bifravstStackName }),
		})
		.promise()
		.then(({ Stacks }) => {
			if (Stacks === undefined || !Stacks.length) {
				throw new Error(
					`${stackId({ bifravstStackName })} stack is not available.`,
				)
			} else {
				const stack = Stacks[0]
				const BucketOutput =
					stack.Outputs &&
					stack.Outputs.find(({ OutputKey }) => OutputKey === 'bucketName')
				if (
					BucketOutput === undefined ||
					BucketOutput.OutputValue === undefined
				) {
					throw new Error(`${stackId({ bifravstStackName })} bucket not found.`)
				}
				return BucketOutput.OutputValue
			}
		})
