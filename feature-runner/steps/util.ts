import {
	matchGroups,
	noMatch,
	type StepRunResult,
	type StepRunner,
	type StepRunnerArgs,
} from '@nordicsemiconductor/bdd-markdown'
import { type Static } from '@sinclair/typebox'

export const matchString = (name: string) => '`(?<' + name + '>[^`]+)`'
export const matchInteger = (name: string) => '(?<' + name + '>-?[1-9][0-9]*)'

export const matchChoice = (name: string, options: string[]) =>
	`(?<${name}>${options.join('|')})`

export const matchStep =
	<
		Context extends Record<string, any>,
		Schema extends Parameters<typeof matchGroups>[0],
	>(
		expression: RegExp,
		schema: Schema,
		onMatch: (
			match: Static<Schema>,
			args: StepRunnerArgs<Context>,
		) => Promise<StepRunResult>,
	): StepRunner<Context> =>
	async (args) => {
		const { step } = args
		const match = matchGroups(schema)(expression, step.title)
		if (match === null) return noMatch
		return onMatch(match, args)
	}
