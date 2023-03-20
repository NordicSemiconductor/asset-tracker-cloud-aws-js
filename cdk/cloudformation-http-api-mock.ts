import { HTTPAPIMockApp } from './apps/HTTPAPIMock.js'
import { prepareHTTPAPIMockLambdas } from './test-resources/prepare-test-resources.js'

new HTTPAPIMockApp({
	packedHTTPAPIMockLambdas: await prepareHTTPAPIMockLambdas(),
}).synth()
