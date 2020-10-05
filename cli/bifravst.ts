import * as program from 'commander'
import * as chalk from 'chalk'
import * as fs from 'fs'
import { Iot, CloudFormation, STS } from 'aws-sdk'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import * as path from 'path'
import { cdCommand } from './commands/cd'
import { createDeviceCertCommand } from './commands/create-device-cert'
import { connectCommand } from './commands/connect'
import { reactConfigCommand } from './commands/react-config'
import { infoCommand } from './commands/info'
import { createCACommand } from './commands/create-ca'
import { historicalDataCommand } from './commands/historical-data'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint'
import { purgeBucketsCommand } from './commands/purge-buckets'
import { dropAthenaResourcesCommand } from './commands/drop-athena-resources'
import { logsCommand } from './commands/logs'
import { cdUpdateTokenCommand } from './commands/cd-update-token'
import { cellLocation } from './commands/cell-location'
import { CommandDefinition } from './commands/CommandDefinition'
import * as readline from 'readline'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals'
import { purgeCAsCommand } from './commands/purge-cas'
import { region } from '../cdk/regions'
import { CORE_STACK_NAME, WEBAPPS_STACK_NAME } from '../cdk/stacks/stackId'
import { firmwareCICommand } from './commands/firmware-ci'
import { certsDir as provideCertsDir } from './jitp/certsDir'

const iot = new Iot({
	region,
})
const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

const so = stackOutput(new CloudFormation({ region }))

const config = async () => {
	const [
		accessKeyInfo,
		endpoint,
		{ historicalDataQueryResultsBucketName, historicalDataBucketName },
	] = await Promise.all([
		new STS().getCallerIdentity().promise(),
		getIotEndpoint(iot),
		so<StackOutputs>(CORE_STACK_NAME),
	])

	return {
		accountId: accessKeyInfo.Account as string,
		endpoint,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
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
		await new Promise((resolve, reject) =>
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
	const {
		accountId,
		endpoint,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
	} = await config()
	const certsDir = await provideCertsDir({
		iotEndpoint: endpoint,
		accountId,
	})

	program.description('Bifravst Command Line Interface')

	const commands = [
		createCACommand({ certsDir }),
		createDeviceCertCommand({ endpoint, certsDir }),
		reactConfigCommand(),
		infoCommand(),
		cdCommand(),
		historicalDataCommand({
			QueryResultsBucketName: historicalDataQueryResultsBucketName,
			DataBucketName: historicalDataBucketName,
		}),
		cellLocation(),
		purgeIotUserPolicyPrincipals(),
		logsCommand(),
	]

	if (isCI) {
		console.error('Running on CI...')
		commands.push(
			dropAthenaResourcesCommand(),
			purgeBucketsCommand(),
			purgeCAsCommand(),
		)
	} else {
		let deviceUiUrl = ''
		try {
			const { deviceUiDomainName } = await so<StackOutputs>(WEBAPPS_STACK_NAME)
			deviceUiUrl = `https://${deviceUiDomainName}`
		} catch (err) {
			console.error(chalk.red.dim(`Could not determine Device UI URL.`))
		}
		commands.push(
			connectCommand({
				endpoint,
				deviceUiUrl,
				certsDir,
				version,
			}),
			cdUpdateTokenCommand(),
			confirm(
				'Do you really want to drop all Athena resources?',
				dropAthenaResourcesCommand(),
			),
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
