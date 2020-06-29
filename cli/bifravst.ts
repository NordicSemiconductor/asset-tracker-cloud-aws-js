import * as program from 'commander'
import * as chalk from 'chalk'
import * as fs from 'fs'
import { Iot, CloudFormation } from 'aws-sdk'
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
import { stackId as generateStackId } from '../cdk/stacks/stackId'

const stackId = generateStackId()
const region = process.env.AWS_DEFAULT_REGION ?? ''
const iot = new Iot({
	region,
})
const version = JSON.parse(
	fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
).version

const so = stackOutput(new CloudFormation({ region }))

const config = async () => {
	const [
		endpoint,
		{ historicalDataQueryResultsBucketName, historicalDataBucketName },
	] = await Promise.all([getIotEndpoint(iot), so<StackOutputs>(stackId)])

	return {
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
		endpoint,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
	} = await config()
	const certsDir = path.resolve(process.cwd(), 'certificates')

	program.description('Bifravst Command Line Interface')

	const commands = [
		createCACommand({ stackId, certsDir, region }),
		createDeviceCertCommand({ endpoint }),
		reactConfigCommand({ region }),
		infoCommand({ stackId, region }),
		cdCommand({ region }),
		historicalDataCommand({
			region,
			QueryResultsBucketName: historicalDataQueryResultsBucketName,
			DataBucketName: historicalDataBucketName,
		}),
		cellLocation({
			region,
		}),
		purgeIotUserPolicyPrincipals({
			stackId,
			region,
		}),
		logsCommand({ stackId, region }),
	]

	if (isCI) {
		console.log('Running on CI...')
		commands.push(
			dropAthenaResourcesCommand({
				stackId,
				region,
			}),
			purgeBucketsCommand({
				stackId,
				region,
			}),
			purgeCAsCommand({
				stackId,
				region,
			}),
		)
	} else {
		const { deviceUiDomainName } = await so<StackOutputs>(
			generateStackId('webapps'),
		)
		commands.push(
			connectCommand({
				endpoint,
				deviceUiUrl: `https://${deviceUiDomainName}`,
				certsDir,
				version,
			}),
			cdUpdateTokenCommand({ region }),
			confirm(
				'Do you really want to drop all Athena resources?',
				dropAthenaResourcesCommand({
					stackId,
					region,
				}),
			),
			confirm(
				'Do you really purge all Bifravst buckets?',
				purgeBucketsCommand({
					stackId,
					region,
				}),
			),
			confirm(
				'Do you really want to purge all Bifravst CAs?',
				purgeCAsCommand({
					stackId,
					region,
				}),
			),
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
