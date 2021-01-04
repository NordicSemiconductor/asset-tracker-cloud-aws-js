import { BifravstApp } from './apps/Bifravst'
import {
	prepareResources,
	prepareBifravstLambdas,
	prepareCDKLambdas,
} from './prepare-resources'
import { SSMClient } from '@aws-sdk/client-ssm'
import { getApiSettings } from '../cellGeolocation/stepFunction/unwiredlabs'
import { region } from './regions'

const fetchUnwiredLabsApiSettings = getApiSettings({
	ssm: new SSMClient({ region }),
})

const rootDir = process.cwd()

Promise.all([
	prepareResources({
		region,
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
		console.debug(
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
