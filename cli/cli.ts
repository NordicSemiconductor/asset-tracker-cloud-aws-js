import { IoTClient } from '@aws-sdk/client-iot'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import * as chalk from 'chalk'
import { program } from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { createInterface } from 'readline'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint'
import { cdCommand } from './commands/cd'
import { cdUpdateTokenCommand } from './commands/cd-update-token'
import { CommandDefinition } from './commands/CommandDefinition'
import { configureCommand } from './commands/configure'
import { createAndProvisionDeviceCertCommand } from './commands/create-and-provision-device-cert'
import { createCACommand } from './commands/create-ca'
import { createSimulatorCertCommand } from './commands/create-simulator-cert'
import { firmwareCICommand } from './commands/firmware-ci'
import { flashFirmwareCommand } from './commands/flash-firmware'
import { imeiCommand } from './commands/imei'
import { infoCommand } from './commands/info'
import { logsCommand } from './commands/logs'
import { purgeBucketsCommand } from './commands/purge-buckets'
import { purgeCAsCommand } from './commands/purge-cas'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals'
import { showAPIConfigurationCommand } from './commands/show-api-configuration'
import { webappCICommand } from './commands/web-app-ci'
import { webAppConfigCommand } from './commands/web-app-config'
import { certsDir as provideCertsDir } from './jitp/certsDir'

const die = (err: Error, origin: any) => {
	console.error(`An unhandled exception occured!`)
	console.error(`Exception origin: ${JSON.stringify(origin)}`)
	console.error(err)
	process.exit(1)
}

process.on('uncaughtException', die)
process.on('unhandledRejection', die)

console.log('')

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
		const rl = createInterface({
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
		webAppConfigCommand(),
		infoCommand(),
		cdCommand(),
		purgeIotUserPolicyPrincipals(),
		logsCommand(),
		configureCommand(),
		showAPIConfigurationCommand(),
	]

	if (isCI) {
		console.error('Running on CI...')
		commands.push(purgeBucketsCommand(), purgeCAsCommand({ certsDir }))
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
				purgeCAsCommand({ certsDir }),
			),
			firmwareCICommand({
				endpoint,
			}),
			webappCICommand(),
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
