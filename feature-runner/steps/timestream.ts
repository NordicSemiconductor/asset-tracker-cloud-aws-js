import {
	QueryCommand,
	TimestreamQueryClient,
} from '@aws-sdk/client-timestream-query'
import {
	InterpolatedStep,
	regexMatcher,
	StepRunnerFunc,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { parseResult } from '@nordicsemiconductor/timestream-helpers'
import type { AssetTrackerWorld } from '../run-features.js'

export const timestreamStepRunners = ({
	timestream,
}: {
	timestream: TimestreamQueryClient
}): ((
	step: InterpolatedStep,
) => StepRunnerFunc<AssetTrackerWorld> | false)[] => {
	return [
		regexMatcher<AssetTrackerWorld>(/^I run this Timestream query$/)(
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
