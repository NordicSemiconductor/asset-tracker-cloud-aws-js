import { AssetTrackerApp } from './apps/AssetTracker'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getUnwiredLabsApiSettings } from '../cellGeolocation/settings/unwiredlabs'
import { warn } from './helper/note'
import { STSClient } from '@aws-sdk/client-sts'
import { loadContext } from './helper/loadContext'
import { CORE_STACK_NAME } from './stacks/stackName'
import { getApiSettings } from '../util/apiConfiguration'
import * as chalk from 'chalk'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'

const ssm = new SSMClient({})
const fetchUnwiredLabsApiSettings = getUnwiredLabsApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})

const rootDir = process.cwd()

Promise.all([
	Promise.all([
		preparePackagedLambdaStorageDir({
			rootDir,
		}),
		getLambdaSourceCodeBucketName(),
	]).then(async ([outDir, sourceCodeBucketName]) => ({
		sourceCodeBucketName,
		packedLambdas: await prepareAssetTrackerLambdas({
			rootDir,
			outDir,
			sourceCodeBucketName,
		}),
		packedCDKLambdas: await prepareCDKLambdas({
			rootDir,
			outDir,
			sourceCodeBucketName,
		}),
	})),
	fetchUnwiredLabsApiSettings().catch(() => ({})),
	getApiSettings({
		ssm,
		stackName: CORE_STACK_NAME,
		scope: 'codebuild',
		api: 'github',
	})().catch(() => ({})),
	loadContext({ sts: new STSClient({}) }),
])
	.then(([lambdaResources, ulApiSettings, codebuildSettings, context]) => {
		const ctx = {
			version: process.env.VERSION ?? '0.0.0-development',
			...context,
		} as Record<string, any>
		const enableUnwiredApi = 'apiKey' in ulApiSettings
		if (!enableUnwiredApi) {
			warn(
				'Cell Geolocation',
				'No UnwiredLabs API key configured. Feature will be disabled.',
			)
			warn(
				'Cell Geolocation',
				`Use ${chalk.greenBright(
					`node cli configure-api cellGeoLocation unwiredlabs apiKey <API key>`,
				)} to set the API key`,
			)
			ctx.unwiredlabs = '0'
		}
		const enableCD = 'token' in codebuildSettings
		if (!enableCD) {
			warn(
				'Continuous Deployment',
				'No GitHub API key configured. Continuous deployment will be disabled.',
			)

			warn(
				'Cell Geolocation',
				`Use ${chalk.greenBright(
					`node cli configure-api codebuild github token <token>`,
				)} to set the token`,
			)
			ctx.cd = '0'
		}
		return new AssetTrackerApp({
			...lambdaResources,
			context: ctx,
		}).synth()
	})
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
