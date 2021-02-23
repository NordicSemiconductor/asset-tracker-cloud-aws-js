import { CatTrackerApp } from './apps/CatTracker'
import {
	prepareResources,
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './prepare-resources'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getUnwiredLabsApiSettings } from '../cellGeolocation/settings/unwiredlabs'
import { warn } from './helper/note'
import { STSClient } from '@aws-sdk/client-sts'
import { loadContext } from './helper/loadContext'
import { CORE_STACK_NAME } from './stacks/stackName'
import { getApiSettings } from '../util/apiConfiguration'
import * as chalk from 'chalk'

const ssm = new SSMClient({})
const fetchUnwiredLabsApiSettings = getUnwiredLabsApiSettings({
	ssm,
	stackName: CORE_STACK_NAME,
})

const rootDir = process.cwd()

Promise.all([
	prepareResources({
		rootDir,
	}).then(async (res) => ({
		...res,
		packedLambdas: await prepareAssetTrackerLambdas({
			...res,
			rootDir,
		}),
		packedCDKLambdas: await prepareCDKLambdas({
			...res,
			rootDir,
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
	.then(([args, ulApiSettings, codebuildSettings, context]) => {
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
		return new CatTrackerApp({
			...args,
			context: ctx,
		}).synth()
	})
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
