import { Iot } from 'aws-sdk'
import * as path from 'path'
import { promises as fs } from 'fs'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import {
	packBaseLayer,
	packLayeredLambdas,
	WebpackMode,
} from '@nrfcloud/package-layered-lambdas'
import { supportedRegions } from './regions'
import chalk from 'chalk'

export type BifravstLambdas = {
	createThingGroup: string
	concatenateRawDeviceMessages: string
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
	const { endpointAddress } = await new Iot({
		region,
	})
		.describeEndpoint({ endpointType: 'iot:Data-ATS' })
		.promise()

	if (!endpointAddress) {
		throw new Error(`Failed to resolved AWS IoT endpoint`)
	}

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
			concatenateRawDeviceMessages: path.resolve(
				rootDir,
				'historicalData',
				'concatenateRawDeviceMessages.ts',
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
