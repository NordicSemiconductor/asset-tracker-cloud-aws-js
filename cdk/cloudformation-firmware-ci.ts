import { FirmwareCIApp } from './apps/FirmwareCI'
import { prepareResources } from './prepare-resources'
import { region } from './regions'

prepareResources({
	region,
	rootDir: process.cwd(),
})
	.then((args) => new FirmwareCIApp(args).synth())
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
