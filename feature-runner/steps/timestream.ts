import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import { TimestreamQuery } from 'aws-sdk'
import { parseResult } from '@bifravst/timestream-helpers'

export const timestreamStepRunners = ({
	timestream,
}: {
	timestream: TimestreamQuery
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => {
	return [
		regexMatcher<BifravstWorld>(/^I run this Timestream query$/)(
			async (_, step, runner) => {
				if (step.interpolatedArgument === undefined) {
					throw new Error('Must provide argument!')
				}

				await runner.progress('timestream', step.interpolatedArgument)
				const res = await timestream
					.query({
						QueryString: step.interpolatedArgument,
					})
					.promise()
				const data = parseResult(res)
				// eslint-disable-next-line require-atomic-updates
				runner.store['timestreamQueryResult'] = data
				return data
			},
		),
	]
}
