import { HTTPAPIMockApp } from './apps/HTTPAPIMock.js'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName.js'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir.js'
import { prepareHTTPAPIMockLambdas } from './test-resources/prepare-test-resources.js'

const rootDir = process.cwd()

Promise.all([
	preparePackagedLambdaStorageDir({
		rootDir,
	}),
	getLambdaSourceCodeBucketName(),
])
	.then(async ([outDir, sourceCodeBucketName]) => ({
		sourceCodeBucketName,
		packedHTTPAPIMockLambdas: await prepareHTTPAPIMockLambdas({
			outDir,
			rootDir,
			sourceCodeBucketName,
		}),
	}))
	.then((args) =>
		new HTTPAPIMockApp({
			...args,
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
