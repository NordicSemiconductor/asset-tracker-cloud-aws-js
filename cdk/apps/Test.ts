import { App } from '@aws-cdk/core'
import { CatTrackerStack } from '../stacks/CatTracker'
import {
	AssetTrackerLambdas,
	CDKLambdas,
	PackedLambdas,
} from '../prepare-resources'
import { FirmwareCIStack } from '../stacks/FirmwareCI'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class TestApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<AssetTrackerLambdas>
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
