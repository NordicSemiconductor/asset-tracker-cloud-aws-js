import CloudFormation from '@aws-cdk/core'
import chalk from 'chalk'

const ENABLED = 'enabled'
const DISABLED = 'disabled'

export const enabledInContext = (node: CloudFormation.ConstructNode) => ({
	key,
	component,
	onDisabled,
	onEnabled,
	onUndefined,
	silent,
}: {
	key: string
	component: string
	onEnabled?: () => void
	onDisabled?: () => void
	onUndefined?: typeof ENABLED | typeof DISABLED
	silent?: boolean
}): boolean => {
	const v = node.tryGetContext(key)
	if (v === '1' || (v === undefined && onUndefined === ENABLED)) {
		const help = []
		help.push(
			chalk.gray(`Component`),
			chalk.blueBright(component),
			chalk.green('enabled.'),
		)
		help.push(
			chalk.gray(`Run`),
			chalk.yellow.dim(`node cli configure-api context stack ${key} 0`),
			chalk.gray(`to disable.`),
		)
		!(silent ?? false) && console.error(...help)
		onEnabled?.()
		return true
	}
	const help = [
		chalk.gray(`Component`),
		chalk.grey.bold(component),
		chalk.gray('disabled.'),
	]
	help.push(
		chalk.gray(`Run`),
		chalk.yellow.dim(`node cli configure-api context stack ${key} 1`),
		chalk.grey(`to enable.`),
	)
	!(silent ?? false) && console.error(...help)
	onDisabled?.()
	return false
}
