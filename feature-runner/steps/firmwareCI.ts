import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import * as path from 'path'
import { createDevice } from '../../cli/firmware-ci/createDevice'
import { Iot } from 'aws-sdk'
import { region } from '../../cdk/regions'
import { deleteDevice } from '../../cli/firmware-ci/deleteDevice'

export const firmwareCIStepRunners = ({
	mqttEndpoint,
}: {
	mqttEndpoint: string
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => {
	return [
		regexMatcher<BifravstWorld>(/^I create a firmware CI device as "([^"]+)"$/)(
			async ([storageName], __, runner) => {
				const { thingName, thingArn } = await createDevice({
					endpoint: mqttEndpoint,
					certsDir: path.resolve(process.cwd(), 'certificates'),
					iot: new Iot({ region }),
					thingGroupName: runner.world['firmwareCI:thingGroupName'],
				})
				runner.store[`${storageName}:name`] = thingName
				runner.store[`${storageName}:arn`] = thingArn
				return thingName
			},
		),
		regexMatcher<BifravstWorld>(/^I delete the firmware CI device "([^"]+)"$/)(
			async ([storageName], __, runner) => {
				return deleteDevice({
					thingName: runner.store[`${storageName}:name`],
					certsDir: path.resolve(process.cwd(), 'certificates'),
					iot: new Iot({ region }),
					thingGroupName: runner.world['firmwareCI:thingGroupName'],
				})
			},
		),
	]
}
