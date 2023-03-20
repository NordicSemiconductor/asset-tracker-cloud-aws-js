import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
import {
	getAGPSLocationApiSettings,
	getGroundFixApiSettings,
	getPGPSLocationApiSettings,
	serviceKeyProperty,
} from '../third-party/nrfcloud.com/settings.js'
import { getSettings } from '../util/settings.js'
import { AssetTrackerApp } from './apps/AssetTracker.js'
import { getStackContexts } from './helper/getStackContexts.js'
import { warn } from './helper/note.js'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas.js'
import { CORE_STACK_NAME } from './stacks/stackName.js'

const ssm = new SSMClient({})
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

const [
	nrfCloudAGPSLocationApiSettings,
	nrfCloudPGPSLocationApiSettings,
	nrfCloudGroundFixApiSettings,
	codebuildSettings,
	context,
] = await Promise.all([
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

const ctx = {
	version: process.env.VERSION ?? '0.0.0-development',
	...context,
} as Record<string, any>

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

new AssetTrackerApp({
	packedLambdas: await prepareAssetTrackerLambdas(),
	packedCDKLambdas: await prepareCDKLambdas(),
	context: ctx,
}).synth()
