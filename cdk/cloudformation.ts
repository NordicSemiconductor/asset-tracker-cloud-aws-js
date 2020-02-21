import { BifravstApp } from './apps/Bifravst'
import { prepareResources } from './prepare-resources'
import { SSM } from 'aws-sdk'
import { getApiSettings } from '../cellGeolocation/stepFunction/unwiredlabs'

const STACK_ID = process.env.STACK_ID || 'bifravst'
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || ''

const fetchCellLocationApiSettings = getApiSettings({
	ssm: new SSM({ region }),
})

Promise.all([
	prepareResources({
		stackId: STACK_ID,
		region,
		rootDir: process.cwd(),
	}),
	fetchCellLocationApiSettings({ api: 'unwiredlabs' }),
])
	.then(([args, { apiKey }]) =>
		new BifravstApp({
			...args,
			enableUnwiredApi: !!apiKey,
		}).synth(),
	)
	.catch(err => {
		console.error(err)
		process.exit(1)
	})
