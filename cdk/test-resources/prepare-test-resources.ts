import * as path from 'path'
import { packLayeredLambdas } from '@nordicsemiconductor/package-layered-lambdas'
import { ConsoleProgressReporter } from '@nordicsemiconductor/package-layered-lambdas/dist/src/reporter'
import { makeLayerFromPackageJSON } from '../helper/lambdas/makeLayerFromPackageJSON'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'

export type HTTPAPIMockLambdas = {
	httpApiMock: string
}

export const prepareHTTPAPIMockLambdas = async ({
	rootDir,
	outDir,
	sourceCodeBucketName,
}: {
	rootDir: string
	outDir: string
	sourceCodeBucketName: string
}): Promise<PackedLambdas<HTTPAPIMockLambdas>> => {
	const reporter = ConsoleProgressReporter('HTTP API Mock Lambdas')
	return {
		layerZipFileName: await (async () => {
			const httpApiMockLayerDir = path.resolve(
				rootDir,
				'dist',
				'lambdas',
				'httpApiMockLayer',
			)
			return makeLayerFromPackageJSON({
				layerName: 'httpApiMock-layer',
				packageJsonFile: path.resolve(rootDir, 'package.json'),
				packageLockJsonFile: path.resolve(rootDir, 'package-lock.json'),
				requiredDependencies: ['@aws-sdk/client-sqs', 'uuid'],
				dir: httpApiMockLayerDir,
				reporter,
				sourceCodeBucketName,
				outDir,
			})
		})(),
		lambdas: await packLayeredLambdas<HTTPAPIMockLambdas>({
			reporter,
			id: 'HTTPAPIMock',
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			lambdas: {
				httpApiMock: path.resolve(
					rootDir,
					'cdk',
					'test-resources',
					'api-mock-lambda.ts',
				),
			},
			tsConfig: path.resolve(rootDir, 'tsconfig.json'),
		}),
	}
}
