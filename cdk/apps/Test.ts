import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst.js'
import {
	BifravstLambdas,
	CDKLambdas,
	PackedLambdas,
} from '../prepare-resources.js'
import { FirmwareCIStack } from '../stacks/FirmwareCI.js'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<BifravstLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		new BifravstStack(this, {
			...args,
			enableUnwiredApi: false, // FIXME: implement e2e test
		})
		new FirmwareCIStack(this, args)
	}
}
