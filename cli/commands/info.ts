import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { IoTClient } from '@aws-sdk/client-iot'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import chalk from 'chalk'
import { getIotEndpoint } from '../../cdk/helper/getIotEndpoint'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { CommandDefinition } from './CommandDefinition'

export const infoCommand = (): CommandDefinition => ({
	command: 'info',
	options: [
		{
			flags: '-o, --output <output>',
			description: 'If set, only return the value of this output',
		},
	],
	action: async ({ output }) => {
		const outputs = {
			...(await stackOutput(new CloudFormationClient({}))(CORE_STACK_NAME)),
			mqttEndpoint: await getIotEndpoint(new IoTClient({})),
		} as Record<string, string>
		if (output !== undefined) {
			if (outputs[output] === undefined) {
				throw new Error(`${output} is not defined.`)
			}
			process.stdout.write(outputs[output])
			return
		}
		Object.entries(outputs).forEach(([k, v]) => {
			console.log(chalk.yellow(k), chalk.green(v))
		})
	},
	help: 'Prints information about your stack',
})
