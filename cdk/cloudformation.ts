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

const STACK_ID = process.env.STACK_ID || 'bifravst'

export type BifravstLambdas = {
	createThingGroup: string
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
