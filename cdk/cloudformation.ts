import { BifravstApp } from './apps/Bifravst.js'
import {
	prepareResources,
	prepareBifravstLambdas,
	prepareCDKLambdas,
} from './prepare-resources.js'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getApiSettings } from '../cellGeolocation/stepFunction/unwiredlabs.js'
import { warn } from './helper/note.js'

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
])
	.then(([args, ulApiSettings]) =>
		new BifravstApp({
			...args,
			enableUnwiredApi: 'apiKey' in ulApiSettings,
			context: {
				version: process.env.VERSION ?? '0.0.0-development',
			},
		}).synth(),
	)
	.catch((err) => {
		console.error(err)
		process.exit(1)
	})
