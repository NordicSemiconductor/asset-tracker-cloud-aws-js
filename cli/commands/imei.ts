import {
	atHostHexfile,
	connect,
	getIMEI,
} from '@nordicsemiconductor/firmware-ci-device-helpers'
import chalk from 'chalk'
import type { CommandDefinition } from './CommandDefinition.js'
import { defaultPort } from './create-and-provision-device-cert.js'

export const imeiCommand = (): CommandDefinition => ({
	command: 'imei',
	options: [
		{
			flags: '-p, --port <port>',
			description: `The port the device is connected to, defaults to ${defaultPort}`,
		},
		{
			flags: '--dk',
			description: `Connected device is a 9160 DK`,
		},
		{
			flags: '-a, --at-host <atHost>',
			description: `Flash at_host from this file`,
		},
		{
			flags: '--debug',
			description: `Log debug messages`,
		},
	],
	action: async ({ dk, port, atHost, debug }) => {
		const connection = await connect({
			atHostHexfile:
				atHost ??
				(dk === true ? atHostHexfile['9160dk'] : atHostHexfile['thingy91']),
			device: port ?? defaultPort,
			warn: console.error,
			debug: debug === true ? console.debug : undefined,
			progress: debug === true ? console.log : undefined,
		})

		const imei = await getIMEI({ at: connection.connection.at })

		console.log()
		console.log(chalk.green('Connected device is'), chalk.blueBright(imei))

		await connection.connection.end()
	},
	help: 'Prints the IMEI of the connected device',
})
