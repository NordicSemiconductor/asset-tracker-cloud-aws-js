import {
	ConsoleProgressReporter,
	makeLayerFromPackageJSON,
	packBaseLayer,
	packLayeredLambdas,
} from '@nordicsemiconductor/package-layered-lambdas'
import * as path from 'path'
import { PackedLambdas } from '../../helper/lambdas/PackedLambdas'

export type AssetTrackerLambdas = {
	storeMessagesInTimestream: string
	geolocateCellHttpApi: string
	invokeStepFunctionFromSQS: string
	geolocateFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	geolocateCellFromNrfCloudStepFunction: string
	neighborCellGeolocationFromNrfCloudStepFunction: string
	cacheCellGeolocationStepFunction: string
	neighborCellGeolocateReportHttpApi: string
	geolocateNeighborCellFromResolvedStepFunction: string
	persistNeighborCellGeolocationStepFunction: string
	agpsDeviceRequestHandler: string
	agpsNrfCloudStepFunction: string
	pgpsDeviceRequestHandler: string
	pgpsNrfCloudStepFunction: string
	wifiSiteSurveyGeolocateSurveyHttpApi: string
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
				geolocateFromCacheStepFunction: path.resolve(
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
					'third-party',
					'unwiredlabs.com',
					'cellgeolocation.ts',
				),
				geolocateCellFromNrfCloudStepFunction: path.resolve(
					rootDir,
					'third-party',
					'nrfcloud.com',
					'cellgeolocation.ts',
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
				neighborCellGeolocationFromNrfCloudStepFunction: path.resolve(
					rootDir,
					'third-party',
					'nrfcloud.com',
					'ncellmeasgeolocation.ts',
				),
				neighborCellGeolocateReportHttpApi: path.resolve(
					rootDir,
					'neighborCellGeolocation',
					'httpApi',
					'locateReport.ts',
				),
				persistNeighborCellGeolocationStepFunction: path.resolve(
					rootDir,
					'neighborCellGeolocation',
					'stepFunction',
					'persist.ts',
				),
				geolocateNeighborCellFromResolvedStepFunction: path.resolve(
					rootDir,
					'neighborCellGeolocation',
					'stepFunction',
					'fromResolved.ts',
				),
				agpsDeviceRequestHandler: path.resolve(
					rootDir,
					'agps',
					'deviceRequestHandler.ts',
				),
				agpsNrfCloudStepFunction: path.resolve(
					rootDir,
					'third-party',
					'nrfcloud.com',
					'agps.ts',
				),
				pgpsDeviceRequestHandler: path.resolve(
					rootDir,
					'pgps',
					'deviceRequestHandler.ts',
				),
				pgpsNrfCloudStepFunction: path.resolve(
					rootDir,
					'third-party',
					'nrfcloud.com',
					'pgps.ts',
				),
				wifiSiteSurveyGeolocateSurveyHttpApi: path.resolve(
					rootDir,
					'wifiSiteSurveyGeolocation',
					'httpApi',
					'locateSurvey.ts',
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
					'@nordicsemiconductor/cloudformation-helpers',
					'uuid',
					'fast-xml-parser',
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
