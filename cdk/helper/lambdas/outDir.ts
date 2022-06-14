import { promises as fs } from 'fs'
import * as path from 'path'

// Prepares the storage director for packed lambdas
export const preparePackagedLambdaStorageDir = async ({
	rootDir,
}: {
	rootDir: string
}): Promise<string> => {
	const outDir = path.resolve(rootDir, 'dist', 'lambdas')
	try {
		await fs.stat(outDir)
	} catch (_) {
		await fs.mkdir(outDir)
	}
	return outDir
}
