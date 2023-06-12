import { App } from 'aws-cdk-lib'
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
		packedLambdas: AssetTrackerLambdas
		packedCDKLambdas: CDKLambdas
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		const coreStack = new AssetTrackerStack(this, {
			...args,
		})
		new FirmwareCIStack(this).addDependency(coreStack)
	}
}
