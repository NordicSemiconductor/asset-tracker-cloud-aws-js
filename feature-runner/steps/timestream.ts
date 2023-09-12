import {
	QueryCommand,
	TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import {
	codeBlockOrThrow,
	type StepRunner,
	type StepRunnerArgs,
} from '@nordicsemiconductor/bdd-markdown'
import { parseResult } from '@nordicsemiconductor/timestream-helpers'
import type { World } from '../run-features.js'
import type { UserCredentials } from './cognito.js'

type TimestreamWorld = World & {
	timestreamQueryResult?: Record<string, any>[]
	cognito?: UserCredentials
}
const steps: StepRunner<TimestreamWorld>[] = [
	{
		match: (title) => /^I run this Timestream query$/.test(title),
		run: async ({
			context,
			step,
			log: { progress },
		}: StepRunnerArgs<TimestreamWorld>): Promise<void> => {
			if (context.cognito === undefined)
				throw new Error(`Cognito authentication not available.`)

			const { code: query } = codeBlockOrThrow(step)

			const timestream = new TimestreamQueryClient({
				credentials: {
					secretAccessKey: context.cognito.SecretKey,
					accessKeyId: context.cognito.AccessKeyId,
					sessionToken: context.cognito.SessionToken,
				},
			})

			progress('timestream', query)
			const res = await timestream.send(
				new QueryCommand({
					QueryString: query,
				}),
			)

			const data = parseResult(res)
			context['timestreamQueryResult'] = data
		},
	},
]

export default steps
