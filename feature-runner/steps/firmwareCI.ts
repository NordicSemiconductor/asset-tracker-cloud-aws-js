import {
	regexMatcher,
	StepRunnerFunc,
	InterpolatedStep,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { AssetTrackerWorld } from '../run-features.js'
import { createDevice } from '../../cli/firmware-ci/createDevice.js'
import { deleteDevice } from '../../cli/firmware-ci/deleteDevice.js'
import { IoTClient } from '@aws-sdk/client-iot'

export const firmwareCIStepRunners = ({
	mqttEndpoint,
	certsDir,
	iot,
}: {
	certsDir: string
	mqttEndpoint: string
	iot: IoTClient
}): ((
	step: InterpolatedStep,
) => StepRunnerFunc<AssetTrackerWorld> | false)[] => {
	return [
		regexMatcher<AssetTrackerWorld>(
			/^I create a firmware CI device as "([^"]+)"$/,
		)(async ([storageName], __, runner) => {
			const { thingName, thingArn } = await createDevice({
				endpoint: mqttEndpoint,
				certsDir,
				iot,
				thingGroupName: runner.world['firmwareCI:thingGroupName'],
				attributes: {
					test: 'e2e',
				},
			})
			runner.store[`${storageName}:name`] = thingName
			runner.store[`${storageName}:arn`] = thingArn
			return thingName
		}),
		regexMatcher<AssetTrackerWorld>(
			/^I delete the firmware CI device "([^"]+)"$/,
		)(async ([storageName], __, runner) => {
			return deleteDevice({
				thingName: runner.store[`${storageName}:name`],
				certsDir,
				iot,
				thingGroupName: runner.world['firmwareCI:thingGroupName'],
			})
		}),
	]
}
