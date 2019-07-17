import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@nrfcloud/package-layered-lambdas'
import { BifravstLambdas } from '../cloudformation'

export class BifravstApp extends App {
	public constructor(args: {
		stackId: string
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
	}) {
		super()
		new BifravstStack(this, args.stackId, args)
	}
}
