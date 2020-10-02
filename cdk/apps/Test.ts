import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { BifravstLambdas } from '../prepare-resources'
import { FirmwareCIStack } from '../stacks/FirmwareCI'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		cloudFormationLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
	}) {
		super()
		new BifravstStack(this, {
			...args,
			isTest: true,
			enableUnwiredApi: false, // FIXME: implement e2e test
		})
		new FirmwareCIStack(this, args)
	}
}
