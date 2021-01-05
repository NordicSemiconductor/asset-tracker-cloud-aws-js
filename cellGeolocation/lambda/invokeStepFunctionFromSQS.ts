import { SQSEvent } from 'aws-lambda'
// Still using old SDK here, because StepFunctions have no CORS support: https://github.com/aws/aws-sdk-js-v3/issues/1162
import { StepFunctions } from 'aws-sdk'
import { fromEnv } from '../../util/fromEnv'

const sf = new StepFunctions()
const { stateMachineArn } = fromEnv({
	stateMachineArn: 'STEP_FUNCTION_ARN',
})(process.env)

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	const res = await Promise.all(
		event.Records.map(async ({ body }) =>
			sf
				.startExecution({
					stateMachineArn,
					input: body,
				})
				.promise(),
		),
	)
	console.log(JSON.stringify(res))
}
