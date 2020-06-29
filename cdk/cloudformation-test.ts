import { TestApp } from './apps/Test'
import { prepareResources } from './prepare-resources'
import { stackId as generateStackId } from './stacks/stackId'

const stackId = generateStackId()
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? ''

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
