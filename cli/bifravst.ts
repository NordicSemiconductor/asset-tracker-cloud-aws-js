import * as program from 'commander'
import * as chalk from 'chalk'
import { Iot } from 'aws-sdk'
import { stackOutput } from './cloudformation/stackOutput'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import * as path from 'path'
import { cdCommand } from './commands/cd'
import { createDeviceCertCommand } from './commands/create-device-cert'
import { connectCommand } from './commands/connect'
import { reactConfigCommand } from './commands/react-config'
import { infoCommand } from './commands/info'
import { createCACommand } from './commands/create-ca'
import { historicalDataCommand } from './commands/historical-data'
import { flashCertificate } from './commands/flash-cert'
import { getIotEndpoint } from '../cdk/helper/getIotEndpoint'
import { purgeBucketsCommand } from './commands/purge-buckets'
import { dropAthenaResourcesCommand } from './commands/drop-athena-resources'
import { stackId as webStackId } from '../cdk/stacks/WebApps'
import { cdUpdateTokenCommand } from './commands/cd-update-token'
import { cellLocation } from './commands/cell-location'
import { ComandDefinition } from './commands/CommandDefinition'
import * as readline from 'readline'
import { purgeIotUserPolicyPrincipals } from './commands/purge-iot-user-policy-principals'

const stackId = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_DEFAULT_REGION || ''
const iot = new Iot({
	region,
})

const config = async () => {
	const [
		endpoint,
		{ historicalDataQueryResultsBucketName, historicalDataBucketName },
	] = await Promise.all([
		getIotEndpoint(iot),
		stackOutput<StackOutputs>({
			region,
			stackId,
		}),
	])

	return {
		endpoint,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
	}
}

const confirmIf = (isCI: boolean) => (
	confirm: string,
	command: ComandDefinition,
): ComandDefinition => ({
	...command,
	action: async (...args) => {
		if (isCI) return command.action(...args)
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		await new Promise((resolve, reject) =>
			rl.question(`${chalk.blueBright(confirm)} (y,N): `, answer => {
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

	const confirmIfCI = confirmIf(isCI)

	program.description('Bifravst Command Line Interface')

	const commands = [
		createCACommand({ stackId, certsDir, region }),
		flashCertificate({ certsDir }),
		createDeviceCertCommand({ endpoint }),
		reactConfigCommand({ stackId, region }),
		infoCommand({ stackId, region }),
		cdCommand({ region }),
		historicalDataCommand({
			stackId,
			region,
			QueryResultsBucketName: historicalDataQueryResultsBucketName,
			DataBucketName: historicalDataBucketName,
		}),
		cellLocation({
			stackId,
			region,
		}),
		confirmIfCI(
			'Do you really want to drop all Athena resources?',
			dropAthenaResourcesCommand({
				stackId,
				region,
			}),
		),
		confirmIfCI(
			'Do you really purge all Bifravst buckets?',
			purgeBucketsCommand({
				stackId,
				region,
			}),
		),
		purgeIotUserPolicyPrincipals({
			stackId,
			region,
		}),
	]

	if (!isCI) {
		const { deviceUiDomainName } = await stackOutput<StackOutputs>({
			region,
			stackId: webStackId({ bifravstStackName: stackId }),
		})
		commands.push(
			connectCommand({
				endpoint,
				deviceUiUrl: `https://${deviceUiDomainName}`,
				certsDir,
			}),
			cdUpdateTokenCommand({ region }),
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
	isCI: !!process.env.CI,
}).catch(err => {
	console.error(chalk.red(err))
	process.exit(1)
})
