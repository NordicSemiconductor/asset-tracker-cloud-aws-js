import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import * as chalk from 'chalk'
import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'

export const infoCommand = (): CommandDefinition => ({
	command: 'info',
	options: [
		{
			flags: '-o, --output <output>',
			description: 'If set, only return the value of this output',
		},
	],
	action: async ({ output }) => {
		const outputs = await stackOutput(new CloudFormationClient({}))(
			CORE_STACK_NAME,
		)
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
