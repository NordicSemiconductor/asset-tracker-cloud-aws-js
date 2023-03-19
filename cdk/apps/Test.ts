import { App } from 'aws-cdk-lib'
import type { PackedLambdas } from '../helper/lambdas/PackedLambdas.js'
import type {
	AssetTrackerLambdas,
	CDKLambdas,
} from '../stacks/AssetTracker/lambdas.js'
import { AssetTrackerStack } from '../stacks/AssetTracker/stack.js'
import { FirmwareCIStack } from '../stacks/FirmwareCI.js'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: {
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<AssetTrackerLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		new AssetTrackerStack(this, {
			...args,
		})
		new FirmwareCIStack(this)
	}
}
