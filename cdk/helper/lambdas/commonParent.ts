import { parse, sep } from 'node:path'

/**
 * Returns the common ancestor directory from a list of files
 */
export const commonParent = (files: string[]): string => {
	if (files.length === 1) return parse(files[0] ?? '').dir + sep
	let index = 0
	let prefix = '/'

	while (files.filter((f) => f.startsWith(prefix)).length === files.length) {
		prefix = files[0]?.slice(0, index++) ?? ''
	}

	return prefix.slice(0, prefix.lastIndexOf('/') + 1)
}
