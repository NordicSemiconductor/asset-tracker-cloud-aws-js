import { Iot } from 'aws-sdk'
import * as path from 'path'
import { promises as fs } from 'fs'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import {
	packBaseLayer,
	packLayeredLambdas,
	WebpackMode,
	LayeredLambdas,
} from '@bifravst/package-layered-lambdas'
import { supportedRegions } from './regions'
import * as chalk from 'chalk'
import { getIotEndpoint } from './helper/getIotEndpoint'
import { spawn } from 'child_process'

export type BifravstLambdas = {
	createThingGroup: string
	concatenateRawMessages: string
	processBatchMessages: string
	geolocateCellHttpApi: string
	invokeStepFunctionFromSQS: string
	geolocateCellFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	cacheCellGeolocationStepFunction: string
	addCellGeolocationHttpApi: string
}

export const prepareResources = async ({
	region,
	rootDir,
}: {
	region: string
	rootDir: string
}): Promise<{
	mqttEndpoint: string
	sourceCodeBucketName: string
	baseLayerZipFileName: string
	cloudFormationLayerZipFileName: string
	lambdas: LayeredLambdas<BifravstLambdas>
}> => {
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
	const sourceCodeBucketName = await getLambdaSourceCodeBucketName()

	// Layer with dependencies for application lambdas
	const baseLayerZipFileName = await packBaseLayer({
		srcDir: rootDir,
		outDir,
		Bucket: sourceCodeBucketName,
	})

	// Dedicated layer for Custom Resource Lambda
	const cloudFormationLayerDir = path.resolve(
		rootDir,
		'dist',
		'lambdas',
		'cloudFormationLayer',
	)
	try {
		await fs.stat(cloudFormationLayerDir)
	} catch (_) {
		await fs.mkdir(cloudFormationLayerDir)
	}
	const devDeps = JSON.parse(
		await fs.readFile(path.resolve(rootDir, 'package.json'), 'utf-8'),
	).devDependencies
	await fs.writeFile(
		path.join(cloudFormationLayerDir, 'package.json'),
		JSON.stringify({
			dependencies: {
				'aws-sdk': devDeps['aws-sdk'],
				'@bifravst/cloudformation-helpers':
					devDeps['@bifravst/cloudformation-helpers'],
			},
		}),
		'utf-8',
	)
	await new Promise((resolve, reject) => {
		const p = spawn('npm', ['i', '--ignore-scripts', '--only=prod'], {
			cwd: cloudFormationLayerDir,
		})
		p.on('close', (code) => {
			if (code !== 0) {
				const msg = `[CloudFormation Layer] npm i in ${cloudFormationLayerDir} exited with code ${code}.`
				return reject(new Error(msg))
			}
			return resolve()
		})
	})
	const cloudFormationLayerZipFileName = await packBaseLayer({
		srcDir: cloudFormationLayerDir,
		outDir,
		Bucket: sourceCodeBucketName,
	})

	// Pack lambdas
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
	})

	return {
		mqttEndpoint: endpointAddress,
		sourceCodeBucketName,
		baseLayerZipFileName,
		cloudFormationLayerZipFileName,
		lambdas,
	}
}
