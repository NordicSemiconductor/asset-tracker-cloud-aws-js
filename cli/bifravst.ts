import * as program from 'commander'
import chalk from 'chalk'
import { Iot } from 'aws-sdk'
import { stackOutput } from './cloudformation/stackOutput'
import { StackOutputs } from '../cdk/stacks/Bifravst'
import * as path from 'path'
import { cdCommand } from './commands/cd'
import { generateCertCommand } from './commands/generate-cert'
import { connectCommand } from './commands/connect'
import { reactConfigCommand } from './commands/react-config'
import { infoCommand } from './commands/info'
import { registerCaCommand } from './commands/register-ca'
import { historicalDataCommand } from './commands/historical-data'
import { flashCertificate } from './commands/flash-cert'

const stackId = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_DEFAULT_REGION || ''
const iot = new Iot({
	region,
})

const config = async () => {
	const [
		endpoint,
		{
			deviceUiDomainName,
			historicalDataQueryResultsBucketName,
			historicalDataBucketName,
		},
	] = await Promise.all([
		iot
			.describeEndpoint({ endpointType: 'iot:Data-ATS' })
			.promise()
			.then(({ endpointAddress }) => `${endpointAddress}`),
		stackOutput<StackOutputs>({
			region,
			stackId,
		}),
	])

	return {
		endpoint,
		deviceUiUrl: `https://${deviceUiDomainName}`,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
	}
}

const bifravstCLI = async () => {
	const {
		endpoint,
		deviceUiUrl,
		historicalDataQueryResultsBucketName,
		historicalDataBucketName,
	} = await config()
	const certsDir = path.resolve(process.cwd(), 'certificates')

	program.description('Bifravst Command Line Interface')

	const commands = [
		registerCaCommand({ stackId, certsDir, region }),
		flashCertificate({ certsDir }),
		generateCertCommand({ endpoint }),
		connectCommand({ endpoint, deviceUiUrl, certsDir }),
		reactConfigCommand({ stackId, region }),
		infoCommand({ stackId, region }),
		cdCommand({ region }),
		historicalDataCommand({
			stackId,
			region,
			QueryResultsBucketName: historicalDataQueryResultsBucketName,
			DataBucketName: historicalDataBucketName,
		}),
	] as const

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

bifravstCLI().catch(err => {
	console.error(chalk.red(err))
	process.exit(1)
})
