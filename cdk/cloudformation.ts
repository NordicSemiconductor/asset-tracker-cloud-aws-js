import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import {
	getAGPSLocationApiSettings,
	getGroundFixApiSettings,
	getPGPSLocationApiSettings,
	serviceKeyProperty,
} from '../third-party/nrfcloud.com/settings'
import { getApiSettings } from '../third-party/unwiredlabs.com/unwiredlabs'
import { getSettings } from '../util/settings'
import { AssetTrackerApp } from './apps/AssetTracker'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import { getStackContexts } from './helper/getStackContexts'
import { preparePackagedLambdaStorageDir } from './helper/lambdas/outDir'
import { warn } from './helper/note'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas'
import { CORE_STACK_NAME } from './stacks/stackName'

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
const fetchNrfCloudGroundFixApiSettings = getGroundFixApiSettings({
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
	fetchNrfCloudGroundFixApiSettings().catch(() => ({})),
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
			nrfCloudGroundFixApiSettings,
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
						`./cli.sh configure thirdParty unwiredlabs apiKey <API key>`,
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
					name: 'Ground Fix',
					context: 'nrfcloudGroundFix',
					configProperty: serviceKeyProperty('groundFix'),
					settings: nrfCloudGroundFixApiSettings,
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
							`./cli.sh configure thirdParty nrfcloud ${configProperty} <service key>`,
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
					'Continuous Deployment',
					`Use ${chalk.greenBright(
						`./cli.sh configure codebuild github token <token>`,
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
