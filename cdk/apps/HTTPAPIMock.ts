import { App } from 'aws-cdk-lib'
import type { PackedLambdas } from '../helper/lambdas/PackedLambdas.js'
import { HttpApiMockStack } from '../test-resources/HttpApiMockStack.js'
import type { HTTPAPIMockLambdas } from '../test-resources/prepare-test-resources.js'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class HTTPAPIMockApp extends App {
	public constructor({
		packedHTTPAPIMockLambdas,
		sourceCodeBucketName,
	}: {
		sourceCodeBucketName: string
		packedHTTPAPIMockLambdas: PackedLambdas<HTTPAPIMockLambdas>
	}) {
		super({
			context: {
				isTest: true,
			},
		})
		new HttpApiMockStack(this, {
			packedHTTPAPIMockLambdas,
			sourceCodeBucketName,
		})
	}
}
