import chalk from 'chalk'

export const warn = (category: string, note: string): void => {
	console.warn('', chalk.magenta('ℹ'), chalk.cyan(category), chalk.grey(note))
}
export const info = (category: string, note: string): void => {
	console.debug(
		'',
		chalk.blue('ℹ'),
		chalk.white.dim(category),
		chalk.gray(note),
	)
}
export const setting = (property: string, value: string): void => {
	console.debug('', chalk.blueBright(property), chalk.yellow(value))
}
