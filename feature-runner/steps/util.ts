export const matchString = (name: string): string => '`(?<' + name + '>[^`]+)`'
export const matchInteger = (name: string): string =>
	'(?<' + name + '>-?[1-9][0-9]*)'

export const matchChoice = (name: string, options: string[]): string =>
	`(?<${name}>${options.join('|')})`
