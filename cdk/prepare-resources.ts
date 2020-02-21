import { Iot } from 'aws-sdk'
import * as path from 'path'
import { promises as fs } from 'fs'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import {
	packBaseLayer,
	packLayeredLambdas,
	WebpackMode,
} from '@bifravst/package-layered-lambdas'
import { supportedRegions } from './regions'
import * as chalk from 'chalk'
import { getIotEndpoint } from './helper/getIotEndpoint'

export type BifravstLambdas = {
	createThingGroup: string
	concatenateRawMessages: string
	processBatchMessages: string
	geolocateCellFromCacheHttpApi: string
	geolocateCellFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	cacheCellGeolocationStepFunction: string
	cacheCellGeolocationFromDeviceIfNewCell: string
}

export const prepareResources = async ({
	stackId,
	region,
	rootDir,
}: {
	stackId: string
	region: string
	rootDir: string
}) => {
	// Detect the AWS IoT endpoint
	const endpointAddress = await getIotEndpoint(
		new Iot({
			region,
		}),
	)

	if (!supportedRegions.includes(region)) {
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(
				`Your region ${region} is not in the list of supported regions!`,
			),
		)
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(`CDK might not be able to successfully deploy.`),
		)
	}

	// Pack the lambdas
	const outDir = path.resolve(rootDir, 'dist', 'lambdas')
	try {
		await fs.stat(outDir)
	} catch (_) {
		await fs.mkdir(outDir)
	}
	const sourceCodeBucketName = await getLambdaSourceCodeBucketName({
		bifravstStackName: stackId,
	})
	const baseLayerZipFileName = await packBaseLayer({
		srcDir: rootDir,
		outDir,
		Bucket: sourceCodeBucketName,
	})
	const lambdas = await packLayeredLambdas<BifravstLambdas>({
		id: 'bifravst',
		mode: WebpackMode.production,
		srcDir: rootDir,
		outDir,
		Bucket: sourceCodeBucketName,
		lambdas: {
			createThingGroup: path.resolve(rootDir, 'cdk', 'createThingGroup.ts'),
			concatenateRawMessages: path.resolve(
				rootDir,
				'historicalData',
				'concatenateRawMessagesLambda.ts',
			),
			processBatchMessages: path.resolve(
				rootDir,
				'historicalData',
				'processBatchMessages.ts',
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
			geolocateCellFromCacheHttpApi: path.resolve(
				rootDir,
				'cellGeolocation',
				'httpApi',
				'fromCache.ts',
			),
			cacheCellGeolocationFromDeviceIfNewCell: path.resolve(
				rootDir,
				'cellGeolocation',
				'cacheFromDeviceIfNewCell.ts',
			),
		},
		tsConfig: path.resolve(rootDir, 'tsconfig.json'),
	})

	return {
		stackId,
		region,
		rootDir,
		mqttEndpoint: endpointAddress,
		sourceCodeBucketName,
		baseLayerZipFileName,
		lambdas,
	}
}
