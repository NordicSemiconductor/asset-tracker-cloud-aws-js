import {
	QueryCommand,
	TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import { parseResult } from '@nordicsemiconductor/timestream-helpers'
import type { World } from '../run-features.js'
import type { UserCredentials } from './cognito.js'
import { retryCheck } from './retryCheck.js'
import { arrayMatching, check, objectMatching } from 'tsmatchers'

type TimestreamWorld = World & {
	cognito?: UserCredentials
}

const retryableQuery = (client: TimestreamQueryClient, QueryString: string) => {
	let result: Record<string, any>[] = []
	return {
		send: async () => {
			const res = await client.send(
				new QueryCommand({
					QueryString,
				}),
			)
			result = parseResult(res)
		},
		result: () => result,
	}
}

const steps = (): StepRunner<TimestreamWorld>[] => {
	let currentQuery: ReturnType<typeof retryableQuery> | undefined = undefined

	return [
		{
			match: (title) => /^I run this Timestream query$/.test(title),
			run: async ({ context, step, log: { progress } }): Promise<void> => {
				const { code: query } = codeBlockOrThrow(step)

				if (context.cognito === undefined)
					throw new Error(`Cognito authentication not available.`)
				const timestream = new TimestreamQueryClient({
					credentials: {
						secretAccessKey: context.cognito.SecretKey,
						accessKeyId: context.cognito.AccessKeyId,
						sessionToken: context.cognito.SessionToken,
					},
				})

				progress('timestream', query)
				currentQuery = retryableQuery(timestream, query)
				await currentQuery.send()
			},
		},
		{
			match: (title) => /^the Timestream result should match$/.test(title),
			run: async ({ step }) =>
				retryCheck(
					() => {
						const code = codeBlockOrThrow(step)
						const expected: Record<string, any>[] = JSON.parse(code.code)

						check(currentQuery?.result() ?? []).is(
							arrayMatching(expected.map((o) => objectMatching(o))),
						)
					},
					async () => {},
				),
		},
	]
}

export default steps
