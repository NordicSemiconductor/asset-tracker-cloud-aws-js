import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import * as chalk from 'chalk'

export const infoCommand = ({
	stackId,
	region,
}: {
	stackId: string
	region: string
}): CommandDefinition => ({
	command: 'info',
	options: [
		{
			flags: '-o, --output <output>',
			description: 'If set, only return the value of this output',
		},
	],
	action: async ({ output }) => {
		const outputs = await stackOutput({
			stackId,
			region,
		})
		if (output) {
			if (outputs[output] === undefined) {
				throw new Error(`${output} is not defined.`)
			}
			console.log(outputs[output])
			return
		}
		Object.entries(outputs).forEach(([k, v]) => {
			console.log(chalk.yellow(k), chalk.green(v))
		})
	},
	help: 'Prints information about your stack',
})
