import { SSMClient } from '@aws-sdk/client-ssm'
import chalk from 'chalk'
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
const fetchStackContexts = getStackContexts({
	ssm,
	stackName: CORE_STACK_NAME,
})

const [codebuildSettings, context] = await Promise.all([
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
