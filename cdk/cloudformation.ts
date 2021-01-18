import { BifravstApp } from './apps/Bifravst'
import {
	prepareResources,
	prepareBifravstLambdas,
	prepareCDKLambdas,
} from './prepare-resources'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getApiSettings } from '../cellGeolocation/stepFunction/unwiredlabs'
import { warn } from './helper/note'
import { STSClient } from '@aws-sdk/client-sts'
import { loadContext } from './helper/loadContext'

const fetchUnwiredLabsApiSettings = getApiSettings({
	ssm: new SSMClient({}),
})

const rootDir = process.cwd()

Promise.all([
	prepareResources({
		rootDir,
	}).then(async (res) => ({
		...res,
		packedLambdas: await prepareBifravstLambdas({
			...res,
			rootDir,
		}),
		packedCDKLambdas: await prepareCDKLambdas({
			...res,
			rootDir,
		}),
	})),
	fetchUnwiredLabsApiSettings({ api: 'unwiredlabs' }).catch(() => {
		warn(
			'Cell Geolocation',
			'No UnwiredLabs API key configured. Feature will be disabled.',
		)
		return {}
	}),
	loadContext({ sts: new STSClient({}) }),
])
	.then(([args, ulApiSettings, context]) =>
		new BifravstApp({
			...args,
			enableUnwiredApi: 'apiKey' in ulApiSettings,
			context: {
				version: process.env.VERSION ?? '0.0.0-development',
				...context,
			},
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
