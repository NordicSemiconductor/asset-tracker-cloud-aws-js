import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { stackId, WebAppsStack } from '../stacks/WebApps'
import { BifravstLambdas } from '../prepare-resources'

export class BifravstApp extends App {
	public constructor(args: {
		stackId: string
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>,
		enableUnwiredApi: boolean
	}) {
		super()
		new BifravstStack(this, args.stackId, {
			...args,
			isTest: false,
		})
		new WebAppsStack(this, stackId({ bifravstStackName: args.stackId }))
	}
}
