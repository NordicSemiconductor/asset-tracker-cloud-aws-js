import * as program from 'commander'
import * as chalk from 'chalk'
import * as fs from 'fs'
import { IoTClient } from '@aws-sdk/client-iot'
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts'
import * as path from 'path'
import { cdCommand } from './commands/cd'
import { createDeviceCertCommand } from './commands/create-device-cert'
import { connectCommand } from './commands/connect'
import { reactConfigCommand } from './commands/react-config'
import { infoCommand } from './commands/info'
import { createCACommand } from './commands/create-ca'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint'
import { purgeBucketsCommand } from './commands/purge-buckets'
import { logsCommand } from './commands/logs'
import { cdUpdateTokenCommand } from './commands/cd-update-token'
import { CommandDefinition } from './commands/CommandDefinition'
import * as readline from 'readline'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals'
import { purgeCAsCommand } from './commands/purge-cas'
import { region } from '../cdk/regions'
import { firmwareCICommand } from './commands/firmware-ci'
import { certsDir as provideCertsDir } from './jitp/certsDir'
import { flashCommand } from './commands/flash'
import { deviceUIConfigCommand } from './commands/device-ui-config'

const iot = new IoTClient({
	region,
})
const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

const config = async () => {
	const [accessKeyInfo, endpoint] = await Promise.all([
		new STSClient({ region }).send(new GetCallerIdentityCommand({})),
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

const bifravstCLI = async ({ isCI }: { isCI: boolean }) => {
	const { accountId, endpoint } = await config()
	const certsDir = await provideCertsDir({
		iotEndpoint: endpoint,
		accountId,
	})

	program.description('Bifravst Command Line Interface')

	const commands = [
		createCACommand({ certsDir }),
		createDeviceCertCommand({ endpoint, certsDir }),
		reactConfigCommand(),
		deviceUIConfigCommand(),
		infoCommand(),
		cdCommand(),
		purgeIotUserPolicyPrincipals(),
		logsCommand(),
	]

	if (isCI) {
		console.error('Running on CI...')
		commands.push(purgeBucketsCommand(), purgeCAsCommand())
	} else {
		commands.push(
			flashCommand({
				certsDir,
			}),
			connectCommand({
				endpoint,
				certsDir,
				version,
			}),
			cdUpdateTokenCommand(),
			confirm(
				'Do you really purge all Bifravst buckets?',
				purgeBucketsCommand(),
			),
			confirm(
				'Do you really want to purge all Bifravst CAs?',
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

bifravstCLI({
	isCI: process.env.CI === '1',
}).catch((err) => {
	console.error(chalk.red(err))
	process.exit(1)
})
