import * as CloudFormation from '@aws-cdk/core'
import * as chalk from 'chalk'

const ENABLED = 'enabled'
const DISABLED = 'disabled'

export const enabledInContext = (node: CloudFormation.ConstructNode) => ({
	key,
	component,
	truthy,
	onDisabled,
	onEnabled,
	onUndefined,
	silent,
}: {
	key: string
	component: string
	truthy?: string
	onEnabled?: () => void
	onDisabled?: () => void
	onUndefined?: typeof ENABLED | typeof DISABLED
	silent?: boolean
}): boolean => {
	const v = node.tryGetContext(key)
	if (v === (truthy ?? '1') || (v === undefined && onUndefined === ENABLED)) {
		const help = []
		help.push(
			chalk.gray(`Component`),
			chalk.blueBright(component),
			chalk.green('enabled.'),
		)
		help.push(
			chalk.gray(`Set context`),
			chalk.grey.bold(`${key}=0`),
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
		chalk.gray(`Set context`),
		chalk.grey.bold(`${key}=${truthy ?? '1'}`),
		chalk.grey(`to enable.`),
	)
	!(silent ?? false) && console.error(...help)
	onDisabled?.()
	return false
}
