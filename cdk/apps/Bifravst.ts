import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { WebAppsStack } from '../stacks/WebApps'
import {
	BifravstLambdas,
	CDKLambdas,
	PackedLambdas,
} from '../prepare-resources'

export class BifravstApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<BifravstLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		enableUnwiredApi: boolean
	}) {
		super()
		new BifravstStack(this, {
			...args,
			isTest: false,
		})
		new WebAppsStack(this)
	}
}
