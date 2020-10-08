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
}: {
	key: string
	component: string
	truthy?: string
	onEnabled?: () => void
	onDisabled?: () => void
	onUndefined?: typeof ENABLED | typeof DISABLED
}): boolean => {
	const v = node.tryGetContext(key)
	if (
		v === (truthy ?? '1') ||
		(v === undefined && (onUndefined ?? DISABLED) === ENABLED)
	) {
		console.error(
			chalk.gray(`Component`),
			chalk.blueBright(component),
			chalk.green('enabled.'),
			chalk.gray(`Do not pass`),
			chalk.grey.bold(`-c ${key}=${truthy ?? '1'}`),
			chalk.gray(`to`),
			chalk.grey.bold(`npx cdk deploy '*'`),
			chalk.grey(`to disable.`),
		)
		onEnabled?.()
		return true
	}
	const help = [
		chalk.gray(`Component`),
		chalk.grey.bold(component),
		chalk.gray('disabled.'),
	]
	if ((onUndefined ?? DISABLED) === ENABLED) {
		help.push(
			chalk.gray(`Do not pass`),
			chalk.grey.bold(`-c ${key}=${v}`),
			chalk.gray(`to`),
			chalk.grey.bold(`npx cdk deploy '*'`),
			chalk.grey(`to enable.`),
		)
	} else {
		help.push(
			chalk.gray(`Pass`),
			chalk.grey.bold(`-c ${key}=${truthy ?? '1'}`),
			chalk.gray(`to`),
			chalk.grey.bold(`npx cdk deploy '*'`),
			chalk.grey(`to enable.`),
		)
	}
	console.error(...help)
	onDisabled?.()
	return false
}
