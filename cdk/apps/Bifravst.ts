import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { WebAppsStack } from '../stacks/WebApps'
import { BifravstLambdas } from '../prepare-resources'
import { stackId } from '../stacks/stackId'

export class BifravstApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		baseLayerZipFileName: string
		lambdas: LayeredLambdas<BifravstLambdas>
		enableUnwiredApi: boolean
	}) {
		super()
		new BifravstStack(this, stackId(), {
			...args,
			isTest: false,
		})
		new WebAppsStack(this, stackId('webapps'))
	}
}
