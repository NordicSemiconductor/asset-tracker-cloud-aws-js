import { BifravstApp } from './apps/Bifravst'
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

const STACK_ID = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || ''

export type BifravstLambdas = {
	createThingGroup: string
	AthenaWorkGroup: string
	AthenaDDLResource: string
	concatenateRawDeviceMessages: string
}

const main = async () => {
	// Detect the AWS IoT endpoint
	const { endpointAddress } = await new Iot({
		region: process.env.AWS_DEFAULT_REGION,
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
	const rootDir = process.cwd()
	const outDir = path.resolve(rootDir, 'dist', 'lambdas')
	try {
		await fs.stat(outDir)
	} catch (_) {
		await fs.mkdir(outDir)
	}
	const sourceCodeBucketName = await getLambdaSourceCodeBucketName({
		bifravstStackName: STACK_ID,
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
			AthenaWorkGroup: path.resolve(rootDir, 'cdk', 'AthenaWorkGroup.ts'),
			AthenaDDLResource: path.resolve(rootDir, 'cdk', 'AthenaDDLResource.ts'),
		},
		tsConfig: path.resolve(rootDir, 'tsconfig.json'),
	})

	new BifravstApp({
		stackId: STACK_ID,
		mqttEndpoint: endpointAddress,
		sourceCodeBucketName,
		baseLayerZipFileName,
		lambdas,
	}).synth()
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
