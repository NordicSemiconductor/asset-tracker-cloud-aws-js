import { IoTClient } from '@aws-sdk/client-iot'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import chalk from 'chalk'
import { program } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint.js'
import { cdUpdateTokenCommand } from './commands/cd-update-token.js'
import { cdCommand } from './commands/cd.js'
import { CommandDefinition } from './commands/CommandDefinition.js'
import { configureCommand } from './commands/configure.js'
import { createAndProvisionDeviceCertCommand } from './commands/create-and-provision-device-cert.js'
import { createCACommand } from './commands/create-ca.js'
import { createSimulatorCertCommand } from './commands/create-simulator-cert.js'
import { firmwareCICommand } from './commands/firmware-ci.js'
import { flashFirmwareCommand } from './commands/flash-firmware.js'
import { imeiCommand } from './commands/imei.js'
import { infoCommand } from './commands/info.js'
import { logsCommand } from './commands/logs.js'
import { purgeBucketsCommand } from './commands/purge-buckets.js'
import { purgeCAsCommand } from './commands/purge-cas.js'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals.js'
import { reactConfigCommand } from './commands/react-config.js'
import { showAPIConfigurationCommand } from './commands/show-api-configuration.js'
import { certsDir as provideCertsDir } from './jitp/certsDir.js'

const iot = new IoTClient({})
const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

const config = async () => {
	const [accessKeyInfo, endpoint] = await Promise.all([
		new STSClient({}).send(new GetCallerIdentityCommand({})),
		getIotEndpoint(iot),
	])

	return {
		accountId: accessKeyInfo.Account as string,
		endpoint,
	}
}

const confirm = (
	confirm: string,
	command: CommandDefinition,
): CommandDefinition => ({
	...command,
	action: async (...args) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		await new Promise<void>((resolve, reject) =>
			rl.question(`${chalk.blueBright(confirm)} (y,N): `, (answer) => {
				rl.close()
				if (answer === 'y') return resolve()
				reject(new Error(`Answered NO to ${confirm}!`))
			}),
		)
		return command.action(...args)
	},
})

const assetTrackerCLI = async ({ isCI }: { isCI: boolean }) => {
	const { accountId, endpoint } = await config()
	const certsDir = await provideCertsDir({
		iotEndpoint: endpoint,
		accountId,
	})

	program.description(`nRF Asset Tracker ${version} Command Line Interface`)
	program.version(version)

	const commands = [
		createCACommand({ certsDir }),
		createSimulatorCertCommand({ certsDir, endpoint }),
		reactConfigCommand(),
		infoCommand(),
		cdCommand(),
		purgeIotUserPolicyPrincipals(),
		logsCommand(),
		configureCommand(),
		showAPIConfigurationCommand(),
	]

	if (isCI) {
		console.error('Running on CI...')
		commands.push(purgeBucketsCommand(), purgeCAsCommand())
	} else {
		commands.push(
			createAndProvisionDeviceCertCommand({ certsDir }),
			flashFirmwareCommand(),
			cdUpdateTokenCommand(),
			confirm(
				'Do you really purge all nRF Asset Tracker buckets?',
				purgeBucketsCommand(),
			),
			confirm(
				'Do you really want to purge all nRF Asset Tracker CAs?',
				purgeCAsCommand(),
			),
			firmwareCICommand({
				endpoint,
			}),
			imeiCommand(),
		)
	}

	let ran = false
	commands.forEach(({ command, action, help, options }) => {
		const cmd = program.command(command)
		cmd
			.action(async (...args) => {
				try {
					ran = true
					await action(...args)
				} catch (error) {
					console.error(
						chalk.red.inverse(' ERROR '),
						chalk.red(`${command} failed!`),
					)
					console.error(chalk.red.inverse(' ERROR '), chalk.red(error))
					process.exit(1)
				}
			})
			.on('--help', () => {
				console.log('')
				console.log(chalk.yellow(help))
				console.log('')
			})
		if (options) {
			options.forEach(({ flags, description, defaultValue }) =>
				cmd.option(flags, description, defaultValue),
			)
		}
	})

	program.parse(process.argv)

	if (!ran) {
		program.outputHelp(chalk.yellow)
		throw new Error('No command selected!')
	}
}

assetTrackerCLI({
	isCI: process.env.CI === '1',
}).catch((err) => {
	console.error(chalk.red(err))
	process.exit(1)
})
