import { SQSEvent } from 'aws-lambda'
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
