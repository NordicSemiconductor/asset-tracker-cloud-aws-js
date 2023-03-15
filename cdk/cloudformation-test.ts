import { TestApp } from './apps/Test'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas'

const rootDir = process.cwd()

Promise.all([
	preparePackagedLambdaStorageDir({
		rootDir,
	}),
	getLambdaSourceCodeBucketName(),
])
	.then(async ([outDir, sourceCodeBucketName]) => ({
		sourceCodeBucketName,
		packedLambdas: await prepareAssetTrackerLambdas({
			sourceCodeBucketName,
			rootDir,
			outDir,
		}),
		packedCDKLambdas: await prepareCDKLambdas({
			sourceCodeBucketName,
			rootDir,
			outDir,
		}),
	}))
	.then((lambdaResources) =>
		new TestApp({
			...lambdaResources,
			context: {
				version: process.env.VERSION ?? '0.0.0-development',
				isTest: true,
				nrfcloudAGPS: '1',
				nrfcloudPGPS: '1',
				nrfcloudGroundFix: '1',
			},
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
