import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@bifravst/e2e-bdd-test-runner'
import { BifravstWorld } from '../run-features'
import { createDevice } from '../../cli/firmware-ci/createDevice'
import { deleteDevice } from '../../cli/firmware-ci/deleteDevice'
import { IoTClient } from '@aws-sdk/client-iot'

export const firmwareCIStepRunners = ({
	mqttEndpoint,
	certsDir,
	iot,
}: {
	certsDir: string
	mqttEndpoint: string
	iot: IoTClient
}): ((step: InterpolatedStep) => StepRunnerFunc<BifravstWorld> | false)[] => {
	return [
		regexMatcher<BifravstWorld>(/^I create a firmware CI device as "([^"]+)"$/)(
			async ([storageName], __, runner) => {
				const { thingName, thingArn } = await createDevice({
					endpoint: mqttEndpoint,
					certsDir,
					iot,
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
					certsDir,
					iot,
					thingGroupName: runner.world['firmwareCI:thingGroupName'],
				})
			},
		),
	]
}
