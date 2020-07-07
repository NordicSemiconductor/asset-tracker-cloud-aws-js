import { TestApp } from './apps/Test'
import { prepareResources } from './prepare-resources'
import { stackId as generateStackId } from './stacks/stackId'
import { region } from './regions'

const stackId = generateStackId()

prepareResources({
	region,
	rootDir: process.cwd(),
})
	.then((args) =>
		new TestApp({
			stackId,
			...args,
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
