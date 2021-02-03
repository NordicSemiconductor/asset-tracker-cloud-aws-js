import * as chalk from 'chalk'

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
