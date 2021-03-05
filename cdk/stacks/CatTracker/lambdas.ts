import * as path from 'path'
import {
	packBaseLayer,
	packLayeredLambdas,
} from '@nordicsemiconductor/package-layered-lambdas'
import { ConsoleProgressReporter } from '@nordicsemiconductor/package-layered-lambdas/dist/src/reporter'
import { makeLayerFromPackageJSON__Unsafe } from '../../helper/lambdas/makeLayerFromPackageJSON'
import { PackedLambdas } from '../../helper/lambdas/PackedLambdas'

export type CatTrackerLambdas = {
	storeMessagesInTimestream: string
	geolocateCellHttpApi: string
	invokeStepFunctionFromSQS: string
	geolocateCellFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	cacheCellGeolocationStepFunction: string
	addCellGeolocationHttpApi: string
}

export type CDKLambdas = {
	createThingGroup: string
}

export const prepareAssetTrackerLambdas = async ({
	rootDir,
	outDir,
	sourceCodeBucketName,
}: {
	rootDir: string
	outDir: string
	sourceCodeBucketName: string
}): Promise<PackedLambdas<CatTrackerLambdas>> => {
	const reporter = ConsoleProgressReporter('Cat Tracker Lambdas')
	return {
		layerZipFileName: await packBaseLayer({
			layerName: 'cat-tracker-layer',
			reporter,
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			// See https://github.com/aws/aws-sdk-js-v3/issues/2051
			installCommand: [
				'npx',
				'--yes',
				'npm@6',
				'ci',
				'--no-audit',
				'--ignore-scripts',
				'--only=prod',
			],
		}),
		lambdas: await packLayeredLambdas<CatTrackerLambdas>({
			reporter,
			id: 'cat-tracker',
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			lambdas: {
				storeMessagesInTimestream: path.resolve(
					rootDir,
					'historicalData',
					'storeMessagesInTimestream.ts',
				),
				invokeStepFunctionFromSQS: path.resolve(
					rootDir,
					'cellGeolocation',
					'lambda',
					'invokeStepFunctionFromSQS.ts',
				),
				geolocateCellFromCacheStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'fromCache.ts',
				),
				geolocateCellFromDeviceLocationsStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'fromDeviceLocations.ts',
				),
				geolocateCellFromUnwiredLabsStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'unwiredlabs.ts',
				),
				cacheCellGeolocationStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'updateCache.ts',
				),
				geolocateCellHttpApi: path.resolve(
					rootDir,
					'cellGeolocation',
					'httpApi',
					'cell.ts',
				),
				addCellGeolocationHttpApi: path.resolve(
					rootDir,
					'cellGeolocation',
					'httpApi',
					'addCellGeolocation.ts',
				),
			},
			tsConfig: path.resolve(rootDir, 'tsconfig.json'),
		}),
	}
}

export const prepareCDKLambdas = async ({
	rootDir,
	outDir,
	sourceCodeBucketName,
}: {
	rootDir: string
	outDir: string
	sourceCodeBucketName: string
}): Promise<PackedLambdas<CDKLambdas>> => {
	const reporter = ConsoleProgressReporter('CDK Lambdas')
	return {
		layerZipFileName: await (async () => {
			const cloudFormationLayerDir = path.resolve(
				rootDir,
				'dist',
				'lambdas',
				'cloudFormationLayer',
			)
			return makeLayerFromPackageJSON__Unsafe({
				layerName: 'cdk-layer',
				packageJson: path.resolve(rootDir, 'package.json'),
				requiredDependencies: [
					'@aws-sdk/client-iot',
					'@nordicsemiconductor/cloudformation-helpers',
				],
				dir: cloudFormationLayerDir,
				reporter,
				sourceCodeBucketName,
				outDir,
			})
		})(),
		lambdas: await packLayeredLambdas<CDKLambdas>({
			reporter,
			id: 'CDK',
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			lambdas: {
				createThingGroup: path.resolve(rootDir, 'cdk', 'createThingGroup.ts'),
			},
			tsConfig: path.resolve(rootDir, 'tsconfig.json'),
		}),
	}
}
