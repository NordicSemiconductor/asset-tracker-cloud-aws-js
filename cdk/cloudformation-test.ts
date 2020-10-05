import { TestApp } from './apps/Test'
import {
	prepareBifravstLambdas,
	prepareCDKLambdas,
	prepareResources,
} from './prepare-resources'
import { region } from './regions'

const rootDir = process.cwd()

prepareResources({
	region,
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
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
