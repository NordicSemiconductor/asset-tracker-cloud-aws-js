import { App } from '@aws-cdk/core'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { BifravstLambdas } from '../prepare-resources'
import { FirmwareCIStack } from '../stacks/FirmwareCI'

export class FirmwareCIApp extends App {
	public constructor(args: {
		sourceCodeBucketName: string
		cloudFormationLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
	}) {
		super()

		new FirmwareCIStack(this, args)
	}
}
