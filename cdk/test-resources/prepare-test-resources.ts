import type { PackedLambda } from '../helper/lambdas/packLambda'
import { packLambdaFromPath } from '../helper/lambdas/packLambdaFromPath.js'
import { packLayer } from '../helper/lambdas/packLayer.js'

export type HTTPAPIMockLambdas = {
	layerZipFileName: string
	lambdas: {
		httpApiMock: PackedLambda
	}
}

export const prepareHTTPAPIMockLambdas =
	async (): Promise<HTTPAPIMockLambdas> => ({
		layerZipFileName: (
			await packLayer({
				dependencies: [
					'@aws-sdk/client-dynamodb',
					'fast-xml-parser',
					// Needed by old AWS SDK
					'uuid',
				],
				id: 'httpApiMock-layer',
			})
		).layerZipFile,
		lambdas: {
			httpApiMock: await packLambdaFromPath(
				'httpApiMock',
				'cdk/test-resources/api-mock-lambda.ts',
			),
		},
	})
