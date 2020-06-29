import { SQSEvent } from 'aws-lambda'
import { StepFunctions } from 'aws-sdk'

const sf = new StepFunctions()
const stateMachineArn = process.env.STEP_FUNCTION_ARN ?? ''

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
