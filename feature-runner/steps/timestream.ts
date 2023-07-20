import {
	QueryCommand,
	TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import {
	codeBlockOrThrow,
	noMatch,
	type StepRunner,
	type StepRunnerArgs,
	type StepRunResult,
} from '@nordicsemiconductor/bdd-markdown'
import { parseResult } from '@nordicsemiconductor/timestream-helpers'
import type { World } from '../run-features.js'
import type { UserCredentials } from './cognito.js'

type TimestreamWorld = World & {
	timestreamQueryResult?: Record<string, any>[]
	cognito?: UserCredentials
}
const steps: StepRunner<TimestreamWorld>[] = [
	async ({
		context,
		step,
		log: {
			step: { progress },
		},
	}: StepRunnerArgs<TimestreamWorld>): Promise<StepRunResult> => {
		if (!/^I run this Timestream query$/.test(step.title)) return noMatch

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
		return { result: data }
	},
]

export default steps
