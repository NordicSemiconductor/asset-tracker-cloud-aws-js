import { Connection } from '@nordicsemiconductor/firmware-ci-device-helpers'
import chalk from 'chalk'
import * as readline from 'readline'
import { defaultFirmwareRepository } from '../commands/flash-firmware'

/**
 * Provides a device that uses readline as the UART interface and requires a human to provide the input.
 * Useful if you do not have physical access to the device.
 */
export const readlineDevice = async (): Promise<Connection> => {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	console.log('')
	console.log(chalk.white('Please program the device with the AT host.'))
	console.log('')
	console.log(chalk.gray('You can find a pre-compiled HEX file on'))
	console.log(
		chalk.blue.underline('https://github.com/NordicSemiconductor/at_host-hex'),
	)
	console.log('')
	await new Promise((resolve) =>
		rl.question('Press Enter to continue ...', resolve),
	)
	console.log('')
	console.log(chalk.white('Connect to the device using UART and'))
	console.log(
		chalk.white('execute the AT commands printed in'),
		chalk.blueBright('blue'),
		chalk.white('.'),
	)
	console.log('')
	console.log(
		chalk.white('Provide the response without the'),
		chalk.whiteBright.bold('OK'),
	)
	console.log(chalk.white('if the response contains data,'))
	console.log(chalk.white('otherwise press Enter.'))
	console.log('')

	return {
		at: async (cmd) => {
			console.log(chalk.blueBright('>'), chalk.blueBright(cmd))
			const response = await new Promise((resolve) =>
				rl.question(
					`${chalk.white(
						`Please provide the device's response:`,
					)}\n${chalk.green('<')} `,
					resolve,
				),
			)
			return [response as string]
		},
		end: async () => {
			console.log('')
			console.log(
				chalk.white(
					'Now program the device with the asset_tracker_v2 firmware.',
				),
			)
			console.log('')
			console.log(chalk.gray('You can find a pre-compiled HEX file on'))
			console.log(chalk.blue.underline(defaultFirmwareRepository))
			console.log('')
		},
	}
}
