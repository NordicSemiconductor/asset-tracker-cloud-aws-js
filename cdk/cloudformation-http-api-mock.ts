import { HTTPAPIMockApp } from './apps/HTTPAPIMock'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir'
import { prepareHTTPAPIMockLambdas } from './test-resources/prepare-test-resources'

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
