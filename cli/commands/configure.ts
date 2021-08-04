import { SSMClient } from '@aws-sdk/client-ssm'
import { CommandDefinition } from './CommandDefinition'
import * as chalk from 'chalk'
import { CORE_STACK_NAME } from '../../cdk/stacks/stackName'
import { putSettings } from '../../util/settings'
import * as fs from 'fs'

export const configureCommand = (): CommandDefinition => ({
	command: 'configure <scope> <system> <property> [value]',
	options: [
		{
			flags: '-d, --deleteBeforeUpdate',
			description: `Useful when depending on the parameter having version 1, e.g. for use in CloudFormation`,
		},
	],
	action: async (
		scope: any,
		system: any,
		property: string,
		value: string | undefined,
		{ deleteBeforeUpdate },
	) => {
		const v = value ?? fs.readFileSync(0, 'utf-8')
		if (v === undefined || v.length === 0) {
			throw new Error(`Must provide value either as argument or via stdin!`)
		}
		const ssm = new SSMClient({})
		const { name } = await putSettings({
			ssm,
			stackName: CORE_STACK_NAME,
			scope,
			system,
		})({
			property,
			value: v,
			deleteBeforeUpdate,
		})

		console.log()
		console.log(
			chalk.green('Updated the configuration'),
			chalk.blueBright(name),
			chalk.green('to'),
			chalk.yellow(v),
		)
	},
	help: 'Configure the system. If value is not provided, it is read from stdin',
})
