import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { packLambda } from './packLambda.js'
export type PackedLambda = { zipFile: string; handler: string }

export const packLambdaFromPath = async (
	id: string,
	sourceFile: string,
	handlerFunction = 'handler',
	baseDir = process.cwd(),
): Promise<PackedLambda> => {
	try {
		await mkdir(path.join(process.cwd(), 'dist', 'lambdas'), {
			recursive: true,
		})
	} catch {
		// Directory exists
	}
	const zipFile = path.join(process.cwd(), 'dist', 'lambdas', `${id}.zip`)
	const { handler } = await packLambda({
		sourceFile: path.join(baseDir, sourceFile),
		zipFile,
	})
	return {
		zipFile,
		handler: handler.replace('.js', `.${handlerFunction}`),
	}
}
