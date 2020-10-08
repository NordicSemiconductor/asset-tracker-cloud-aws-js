import { CommandDefinition } from './CommandDefinition'
import * as path from 'path'
import { connect } from '../device/connect'
import { StackOutputs } from '../../cdk/stacks/Bifravst'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { CloudFormation } from 'aws-sdk'
import { region } from '../../cdk/regions'
import * as chalk from 'chalk'
import { DEVICEUI_STACK_NAME } from '../../cdk/stacks/stackName'

export const connectCommand = ({
	endpoint,
	certsDir,
	version,
}: {
	endpoint: string
	certsDir: string
	version: string
}): CommandDefinition => ({
	command: 'connect <deviceId>',
	options: [
		{
			flags: '-e, --endpoint <endpoint>',
			description: `AWS IoT endpoint to use, default: ${endpoint}`,
		},
	],
	action: async (deviceId: string, { endpoint: e }) => {
		let deviceUiUrl = ''
		try {
			const { deviceUiDomainName } = await stackOutput(
				new CloudFormation({ region }),
			)<StackOutputs>(DEVICEUI_STACK_NAME)
			deviceUiUrl = `https://${deviceUiDomainName}`
		} catch (err) {
			console.error(chalk.red.dim(`Could not determine Device UI URL.`))
		}
		return connect({
			deviceId,
			deviceUiUrl,
			endpoint: e ?? endpoint,
			certsDir,
			caCert: path.resolve(process.cwd(), 'data', 'AmazonRootCA1.pem'),
			version,
		})
	},
	help: 'Connect to the AWS IoT broker using a generated device certificate.',
})
