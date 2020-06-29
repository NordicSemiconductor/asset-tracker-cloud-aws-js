import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import { query, parseResult } from '@bifravst/athena-helpers'
import { Athena } from 'aws-sdk'

export const athenaStepRunners = ({
	region,
	historicaldataWorkgroupName,
}: {
	region: string
	historicaldataWorkgroupName: string
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => [
	regexMatcher<BifravstWorld>(
		/^I run this query in the Athena workgroup ([^ ]+)$/,
	)(async (_, step, runner) => {
		if (step.interpolatedArgument === undefined) {
			throw new Error('Must provide argument!')
		}
		const athena = new Athena({
			region,
		})
		const q = query({
			WorkGroup: historicaldataWorkgroupName,
			athena,
			debugLog: async (...args: any) => {
				await runner.progress('[athena:debug]', JSON.stringify(args))
			},
			errorLog: async (...args: any) => {
				await runner.progress('[athena:error]', JSON.stringify(args))
			},
		})
		await runner.progress('[athena]', step.interpolatedArgument)
		const ResultSet = await q({ QueryString: step.interpolatedArgument })
		const data = parseResult({
			ResultSet,
			skip: 1,
		})
		// eslint-disable-next-line require-atomic-updates
		runner.store['athenaQueryResult'] = data
		return data
	}),
]
