import * as path from 'path'
import {
	packBaseLayer,
	packLayeredLambdas,
	makeLayerFromPackageJSON,
} from '@nordicsemiconductor/package-layered-lambdas'
import { ConsoleProgressReporter } from '@nordicsemiconductor/package-layered-lambdas/dist/src/reporter'
import { PackedLambdas } from '../../helper/lambdas/PackedLambdas'

export type AssetTrackerLambdas = {
	storeMessagesInTimestream: string
	geolocateCellHttpApi: string
	invokeStepFunctionFromSQS: string
	geolocateCellFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	geolocateCellFromNrfConnectForCloudStepFunction: string
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
}): Promise<PackedLambdas<AssetTrackerLambdas>> => {
	const reporter = ConsoleProgressReporter('nRF Asset Tracker Lambdas')
	return {
		layerZipFileName: await packBaseLayer({
			layerName: 'asset-tracker-layer',
			reporter,
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
		}),
		lambdas: await packLayeredLambdas<AssetTrackerLambdas>({
			reporter,
			id: 'asset-tracker',
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
				geolocateCellFromNrfConnectForCloudStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'nrfconnectforcloud.ts',
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
			return makeLayerFromPackageJSON({
				layerName: 'cdk-layer',
				packageJsonFile: path.resolve(rootDir, 'package.json'),
				packageLockJsonFile: path.resolve(rootDir, 'package-lock.json'),
				requiredDependencies: [
					'@aws-sdk/client-iot',
					'@nordicsemiconductor/cloudformation-helpers',
					'uuid',
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
