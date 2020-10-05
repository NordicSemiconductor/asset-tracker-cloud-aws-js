import { App } from '@aws-cdk/core'
import { LambdaSourceCodeStorageStack } from '../stacks/LambdaSourceCodeStorage'

/**
 * In order to deploy lambda functions written in TypeScript we need to publish
 * the compiled source code to an S3 bucket.
 * This app provides the bucket and run before the main app.
 */
export class LambdaSourceCodeStorageApp extends App {
	public constructor() {
		super()

		new LambdaSourceCodeStorageStack(this)
	}
}
