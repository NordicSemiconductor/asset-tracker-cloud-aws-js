import { AssetTrackerApp } from './apps/AssetTracker'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getApiSettings } from '../third-party/unwiredlabs.com/unwiredlabs'
import {
	getAGPSLocationApiSettings,
	getCellLocationApiSettings,
	getPGPSLocationApiSettings,
	serviceKeyProperty,
} from '../third-party/nrfcloud.com/settings'
import { warn } from './helper/note'
import { CORE_STACK_NAME } from './stacks/stackName'
import { getSettings } from '../util/settings'
import * as chalk from 'chalk'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import { getStackContexts } from './helper/getStackContexts'

const ssm = new SSMClient({})
const fetchUnwiredLabsApiSettings = getApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})
const fetchNrfCloudAGPSLocationApiSettings = getAGPSLocationApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})
const fetchNrfCloudPGPSLocationApiSettings = getPGPSLocationApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})
const fetchNrfCloudCellLocationApiSettings = getCellLocationApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})
const fetchStackContexts = getStackContexts({
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
	fetchNrfCloudAGPSLocationApiSettings().catch(() => ({})),
	fetchNrfCloudPGPSLocationApiSettings().catch(() => ({})),
	fetchNrfCloudCellLocationApiSettings().catch(() => ({})),
	getSettings<{ token: string }>({
		ssm,
		stackName: CORE_STACK_NAME,
		scope: 'codebuild',
		system: 'github',
	})().catch(() => ({})),
	fetchStackContexts(),
])
	.then(
		([
			lambdaResources,
			unwiredLabsApiSettings,
			nrfCloudAGPSLocationApiSettings,
			nrfCloudPGPSLocationApiSettings,
			nrfCloudCellLocationApiSettings,
			codebuildSettings,
			context,
		]) => {
			const ctx = {
				version: process.env.VERSION ?? '0.0.0-development',
				...context,
			} as Record<string, any>

			const enableUnwiredApi = 'apiKey' in unwiredLabsApiSettings
			if (!enableUnwiredApi) {
				warn(
					'Location Services',
					'No UnwiredLabs API key configured. Feature will be disabled.',
				)
				warn(
					'Location Services',
					`Use ${chalk.greenBright(
						`node cli configure thirdParty unwiredlabs apiKey <API key>`,
					)} to set the API key`,
				)
				ctx.unwiredlabs = '0'
			}

			for (const { name, context, configProperty, settings } of [
				{
					name: 'Assisted GPS',
					context: 'nrfcloudAGPS',
					configProperty: serviceKeyProperty('agpsLocation'),
					settings: nrfCloudAGPSLocationApiSettings,
				},
				{
					name: 'Predicted GPS',
					context: 'nrfcloudPGPS',
					configProperty: serviceKeyProperty('pgpsLocation'),
					settings: nrfCloudPGPSLocationApiSettings,
				},
				{
					name: 'Cell Location',
					context: 'nrfcloudCellLocation',
					configProperty: serviceKeyProperty('cellLocation'),
					settings: nrfCloudCellLocationApiSettings,
				},
			]) {
				if (!('serviceKey' in settings)) {
					warn(
						'Location Services',
						`No nRF Cloud ${name} Location Service service key configured. Feature will be disabled.`,
					)
					warn(
						'Location Services',
						`Use ${chalk.greenBright(
							`node cli configure thirdParty nrfcloud ${configProperty} <service key>`,
						)} to set the service key`,
					)
					ctx[context] = '0'
				}
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
						`node cli configure codebuild github token <token>`,
					)} to set the token`,
				)
				ctx.cd = '0'
			}

			return new AssetTrackerApp({
				...lambdaResources,
				context: ctx,
			}).synth()
		},
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
