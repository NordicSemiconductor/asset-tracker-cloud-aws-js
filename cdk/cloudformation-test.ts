import { TestApp } from './apps/Test'
import {
	prepareBifravstLambdas,
	prepareCDKLambdas,
	prepareResources,
} from './prepare-resources'

const rootDir = process.cwd()

prepareResources({
	rootDir,
})
	.then(async (res) => ({
		...res,
		packedLambdas: await prepareBifravstLambdas({
			...res,
			rootDir,
		}),
		packedCDKLambdas: await prepareCDKLambdas({
			...res,
			rootDir,
		}),
	}))
	.then((args) =>
		new TestApp({
			...args,
			context: {
				version: process.env.VERSION ?? '0.0.0-development',
				isTest: true,
			},
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
