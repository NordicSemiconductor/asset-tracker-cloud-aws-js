import pjson from '../../../package.json'
import type { PackedLambda } from '../../helper/lambdas/packLambda.js'
import { packLambdaFromPath } from '../../helper/lambdas/packLambdaFromPath.js'
import { packLayer } from '../../helper/lambdas/packLayer.js'

export type AssetTrackerLambdas = {
	layerZipFileName: string
	lambdas: {
		storeMessagesInTimestream: PackedLambda
		geolocateCellHttpApi: PackedLambda
		invokeStepFunctionFromSQS: PackedLambda
		geolocateFromCacheStepFunction: PackedLambda
		geolocateCellFromNrfCloudStepFunction: PackedLambda
		cacheCellGeolocationStepFunction: PackedLambda
		agnssDeviceRequestHandler: PackedLambda
		agnssNrfCloudStepFunction: PackedLambda
		pgpsDeviceRequestHandler: PackedLambda
		pgpsNrfCloudStepFunction: PackedLambda
		geolocateNetworkSurveyHttpApi: PackedLambda
		networkSurveyGeolocateFromNrfCloudStepFunction: PackedLambda
	}
}

export type CDKLambdas = {
	layerZipFileName: string
	lambdas: {
		createThingGroup: PackedLambda
	}
}

export const prepareAssetTrackerLambdas =
	async (): Promise<AssetTrackerLambdas> => ({
		layerZipFileName: (
			await packLayer({
				id: 'asset-tracker-layer',
				dependencies: Object.keys(pjson.dependencies),
			})
		).layerZipFile,
		lambdas: {
			storeMessagesInTimestream: await packLambdaFromPath(
				'storeMessagesInTimestream',
				'historicalData/storeMessagesInTimestream.ts',
			),
			invokeStepFunctionFromSQS: await packLambdaFromPath(
				'invokeStepFunctionFromSQS',
				'cellGeolocation/lambda/invokeStepFunctionFromSQS.ts',
			),
			geolocateFromCacheStepFunction: await packLambdaFromPath(
				'geolocateFromCacheStepFunction',
				'cellGeolocation/stepFunction/fromCache.ts',
			),
			geolocateCellFromNrfCloudStepFunction: await packLambdaFromPath(
				'geolocateCellFromNrfCloudStepFunction',
				'third-party/nrfcloud.com/cellgeolocation.ts',
			),
			cacheCellGeolocationStepFunction: await packLambdaFromPath(
				'cacheCellGeolocationStepFunction',
				'cellGeolocation/stepFunction/updateCache.ts',
			),
			geolocateCellHttpApi: await packLambdaFromPath(
				'geolocateCellHttpApi',
				'cellGeolocation/httpApi/cell.ts',
			),
			agnssDeviceRequestHandler: await packLambdaFromPath(
				'agnssDeviceRequestHandler',
				'agnss/deviceRequestHandler.ts',
			),
			agnssNrfCloudStepFunction: await packLambdaFromPath(
				'agnssNrfCloudStepFunction',
				'third-party/nrfcloud.com/agnss.ts',
			),
			pgpsDeviceRequestHandler: await packLambdaFromPath(
				'pgpsDeviceRequestHandler',
				'pgps/deviceRequestHandler.ts',
			),
			pgpsNrfCloudStepFunction: await packLambdaFromPath(
				'pgpsNrfCloudStepFunction',
				'third-party/nrfcloud.com/pgps.ts',
			),
			geolocateNetworkSurveyHttpApi: await packLambdaFromPath(
				'geolocateNetworkSurveyHttpApi',
				'networkSurveyGeolocation/httpApi/locateSurvey.ts',
			),
			networkSurveyGeolocateFromNrfCloudStepFunction: await packLambdaFromPath(
				'networkSurveyGeolocateFromNrfCloudStepFunction',
				'third-party/nrfcloud.com/networksurveygeolocation.ts',
			),
		},
	})

export const prepareCDKLambdas = async (): Promise<CDKLambdas> => ({
	layerZipFileName: (
		await packLayer({
			dependencies: ['@nordicsemiconductor/cloudformation-helpers'],
			id: 'cdk-layer',
		})
	).layerZipFile,
	lambdas: {
		createThingGroup: await packLambdaFromPath(
			'createThingGroup',
			'cdk/createThingGroup.ts',
		),
	},
})
