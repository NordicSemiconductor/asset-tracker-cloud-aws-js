import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import {
	QueryCommand,
	TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import { parseResult } from '@bifravst/timestream-helpers'

export const timestreamStepRunners = ({
	timestream,
}: {
	timestream: TimestreamQueryClient
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => {
	return [
		regexMatcher<BifravstWorld>(/^I run this Timestream query$/)(
			async (_, step, runner) => {
				if (step.interpolatedArgument === undefined) {
					throw new Error('Must provide argument!')
				}

				await runner.progress('timestream', step.interpolatedArgument)
				const res = await timestream.send(
					new QueryCommand({
						QueryString: step.interpolatedArgument,
					}),
				)

				const data = parseResult(res)
				// eslint-disable-next-line require-atomic-updates
				runner.store['timestreamQueryResult'] = data
				return data
			},
		),
	]
}
