import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import type { SQSEvent } from 'aws-lambda'
import { fromEnv } from '../../util/fromEnv.js'

const sf = new SFNClient({})
const { stateMachineArn } = fromEnv({
	stateMachineArn: 'STEP_FUNCTION_ARN',
})(process.env)

export const handler = async (event: SQSEvent): Promise<void> => {
	console.log(JSON.stringify({ event }))
	const res = await Promise.all(
		event.Records.map(async ({ body }) =>
			sf.send(
				new StartExecutionCommand({
					stateMachineArn,
					input: body,
				}),
			),
		),
	)
	console.log(JSON.stringify(res))
}
