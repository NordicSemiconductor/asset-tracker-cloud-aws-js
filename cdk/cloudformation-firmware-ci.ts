import { FirmwareCIApp } from './apps/FirmwareCI'
import { prepareCDKLambdas, prepareResources } from './prepare-resources'
import { region } from './regions'

const rootDir = process.cwd()

prepareResources({
	region,
	rootDir,
})
	.then(async (res) => ({
		...res,
		packedCDKLambdas: await prepareCDKLambdas({
			...res,
			rootDir,
		}),
	}))
	.then((args) => new FirmwareCIApp(args).synth())
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
