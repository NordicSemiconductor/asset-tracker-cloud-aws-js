import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import { CommandDefinition } from './CommandDefinition.js'
import chalk from 'chalk'
import { StackOutputs as FirmwareCIStackOutputs } from '../../cdk/stacks/FirmwareCI.js'
import { FIRMWARE_CI_STACK_NAME } from '../../cdk/stacks/stackName.js'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { createDevice } from '../firmware-ci/createDevice.js'
import { deviceFileLocations } from '../jitp/deviceFileLocations.js'
import { deleteDevice } from '../firmware-ci/deleteDevice.js'

export const firmwareCICommand = ({
	endpoint,
	certsDir,
}: {
	endpoint: string
	certsDir: string
}): CommandDefinition => ({
	command: 'firmware-ci',
	help: 'Show firmware CI status',
	options: [
		{
			flags: '-c, --create',
			description: 'Create a new device for a CI runner',
		},
		{
			flags: '-r, --remove <deviceId>',
			description: 'Delete a CI runner device',
		},
		{
			flags: '-s, --show-secret',
			description: 'Show the secret access key for the CI runner',
		},
	],
	action: async ({ create, showSecret, remove }) => {
		const cf = new CloudFormationClient({})
		const firmwareCIStackConfig = await stackOutput(cf)<FirmwareCIStackOutputs>(
			FIRMWARE_CI_STACK_NAME,
		)
		console.log()
		console.log(
			chalk.grey('  Region:            '),
			chalk.yellow(endpoint.split('.')[2]),
		)
		console.log(
			chalk.grey('  Bucket name:       '),
			chalk.yellow(firmwareCIStackConfig.bucketName),
		)
		console.log(
			chalk.grey('  Access Key ID:     '),
			chalk.yellow(firmwareCIStackConfig.userAccessKeyId),
		)
		console.log(
			chalk.grey('  Secret Access Key: '),
			chalk.yellow(
				showSecret === true
					? firmwareCIStackConfig.userSecretAccessKey
					: firmwareCIStackConfig.userSecretAccessKey.substr(0, 5) + '***',
			),
		)
		const iot = new IoTClient({
			credentials: {
				accessKeyId: firmwareCIStackConfig.userAccessKeyId,
				secretAccessKey: firmwareCIStackConfig.userSecretAccessKey,
			},
		})

		if (create === true) {
			const { thingName: deviceId } = await createDevice({
				iot,
				thingGroupName: firmwareCIStackConfig.thingGroupName,
				endpoint,
				certsDir,
				attributes: {
					test: 'firmware',
				},
			})
			console.log()
			console.log(
				chalk.green(
					`Firmware CI runner device ${chalk.yellow(deviceId)} created.`,
				),
			)
			console.log()
			console.log(
				chalk.gray('Use the file'),
				chalk.yellow(deviceFileLocations({ certsDir, deviceId }).json),
			)
			console.log(
				chalk.gray('with the'),
				chalk.blue.italic('Firmware CI runner'),
			)
			console.log(
				chalk.gray(
					'https://github.com/NordicSemiconductor/asset-tracker-cloud-firmware-ci',
				),
			)
		}

		if (remove !== undefined) {
			await deleteDevice({
				iot,
				thingGroupName: firmwareCIStackConfig.thingGroupName,
				certsDir,
				thingName: remove,
			})
			console.log()
			console.log(
				chalk.green(
					`Firmware CI runner device ${chalk.yellow(remove)} deleted.`,
				),
			)
		}
	},
})
