import { App } from '@aws-cdk/core'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'
import { CatTrackerLambdas, CDKLambdas } from '../stacks/CatTracker/lambdas'
import { CatTrackerStack } from '../stacks/CatTracker/stack'
import { FirmwareCIStack } from '../stacks/FirmwareCI'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: {
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<CatTrackerLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		new CatTrackerStack(this, {
			...args,
		})
		new FirmwareCIStack(this, args)
	}
}
