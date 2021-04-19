import program from 'commander'
import chalk from 'chalk'
import fs from 'fs'
import { IoTClient } from '@aws-sdk/client-iot'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import path from 'path'
import { cdCommand } from './commands/cd.js'
import { createDeviceCertCommand } from './commands/create-device-cert.js'
import { reactConfigCommand } from './commands/react-config.js'
import { infoCommand } from './commands/info.js'
import { createCACommand } from './commands/create-ca.js'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint.js'
import { purgeBucketsCommand } from './commands/purge-buckets.js'
import { logsCommand } from './commands/logs.js'
import { cdUpdateTokenCommand } from './commands/cd-update-token.js'
import { CommandDefinition } from './commands/CommandDefinition.js'
import readline from 'readline'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals.js'
import { purgeCAsCommand } from './commands/purge-cas.js'
import { firmwareCICommand } from './commands/firmware-ci.js'
import { certsDir as provideCertsDir } from './jitp/certsDir.js'
import { flashCommand } from './commands/flash.js'
import { configureAPICommand } from './commands/configure-api.js'
import { showAPIConfigurationCommand } from './commands/show-api-configuration.js'

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
		createDeviceCertCommand({ endpoint, certsDir }),
		reactConfigCommand(),
		infoCommand(),
		cdCommand(),
		purgeIotUserPolicyPrincipals(),
		logsCommand(),
		configureAPICommand(),
		showAPIConfigurationCommand(),
	]

	if (isCI) {
		console.error('Running on CI...')
		commands.push(purgeBucketsCommand(), purgeCAsCommand())
	} else {
		commands.push(
			flashCommand({
				certsDir,
			}),
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
				certsDir,
			}),
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
