import { App } from '@aws-cdk/core'
import { AssetTrackerStack } from '../stacks/AssetTracker'
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
		new AssetTrackerStack(this, {
			...args,
		})
		new FirmwareCIStack(this, args)
	}
}
