import * as path from 'path'
import { promises as fs } from 'fs'
import * as chalk from 'chalk'

/**
 * Ensures the directory for storing certificates is available
 */
export const certsDir = async ({
	accountId,
	iotEndpoint,
	workingDirectory,
}: {
	accountId: string
	iotEndpoint: string
	workingDirectory?: string
}): Promise<string> => {
	const dir = path.resolve(
		path.join(
			workingDirectory ?? process.cwd(),
			'certificates',
			`${accountId}-${iotEndpoint}`,
		),
	)
	try {
		await fs.stat(dir)
	} catch {
		await fs.mkdir(dir, { recursive: true })
		console.error(chalk.magenta(`[certsDir]`), chalk.grey(`${dir} created.`))
	}
	return dir
}
