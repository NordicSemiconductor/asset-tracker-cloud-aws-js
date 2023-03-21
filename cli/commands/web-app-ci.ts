import chalk from 'chalk'
import {
	WEBAPP_CI_STACK_NAME,
	WEBAPP_STACK_NAME,
} from '../../cdk/stacks/stackName.js'
import { fromEnv } from '../../util/fromEnv.js'
import type { CommandDefinition } from './CommandDefinition.js'

const { region } = fromEnv({ region: 'AWS_REGION' })(process.env)

export const webappCICommand = ({
	accountId,
}: {
	accountId: string
}): CommandDefinition => ({
	command: 'web-app-ci',
	help: 'Print web app CI environment',
	action: async () => {
		const info = {
			AWS_REGION: region,
			AWS_ROLE: `arn:aws:iam::${accountId}:role/${WEBAPP_CI_STACK_NAME}-github-actions`,
			WEBAPP_STACK_NAME: WEBAPP_STACK_NAME,
		}

		console.log(chalk.white(`Configure these GitHub Actions secrets:`))
		console.log()
		Object.entries(info).forEach(([k, v]) =>
			console.log(chalk.blue(`${k}:`), chalk.magenta(v)),
		)
		console.log()
		console.log(
			chalk.white(`Using the GitHub CLI`),
			chalk.gray(`(in the web-app repository)`),
		)
		console.log()
		Object.entries(info).forEach(([k, v]) =>
			console.log(
				chalk.yellow(`gh secret set ${k} --body ${v} --env production`),
			),
		)
	},
})
