import { App } from 'aws-cdk-lib'
import { HttpApiMockStack } from '../test-resources/HttpApiMockStack.js'
import type { HTTPAPIMockLambdas } from '../test-resources/prepare-test-resources.js'

/**
 * This sets up the parts of the app needed for the end-to-end tests
 */
export class HTTPAPIMockApp extends App {
	public constructor({
		packedHTTPAPIMockLambdas,
	}: {
		packedHTTPAPIMockLambdas: HTTPAPIMockLambdas
	}) {
		super({
			context: {
				isTest: true,
			},
		})
		new HttpApiMockStack(this, {
			packedHTTPAPIMockLambdas,
		})
	}
}
