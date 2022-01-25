import { App } from 'aws-cdk-lib'
import { readFileSync } from 'fs'
import * as path from 'path'
import { enabledInContext } from '../helper/enabledInContext'
import { extractRepoAndOwner } from '../helper/extract-repo-and-owner'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'
import { AssetTrackerLambdas, CDKLambdas } from '../stacks/AssetTracker/lambdas'
import { AssetTrackerStack } from '../stacks/AssetTracker/stack'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment'
import { FirmwareCIStack } from '../stacks/FirmwareCI'
import { WebAppStack } from '../stacks/WebApp'
import { WebAppCIStack } from '../stacks/WebAppCI'

export class AssetTrackerApp extends App {
	public constructor(args: {
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<AssetTrackerLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		// Core
		new AssetTrackerStack(this, {
			...args,
		})
		const checkFlag = enabledInContext(this.node)
		// Web App
		checkFlag({
			key: 'webapp',
			component: 'Web App',
			onUndefined: 'enabled',
			onEnabled: () => new WebAppStack(this),
		})
		// Firmware CI
		checkFlag({
			key: 'firmware-ci',
			component: 'Firmware CI',
			onEnabled: () => {
				new FirmwareCIStack(this)
			},
		})
		// Web App CI
		checkFlag({
			key: 'web-app-ci',
			component: 'Web App CI',
			onEnabled: () => {
				new WebAppCIStack(this)
			},
		})
		// CD
		checkFlag({
			key: 'cd',
			component: 'Continuous Deployment',
			onEnabled: () => {
				const pjson = JSON.parse(
					readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
				)
				new ContinuousDeploymentStack(this, {
					core: {
						...extractRepoAndOwner(pjson.repository.url),
						branch: pjson.deploy.branch ?? 'saga',
					},
					webApp: {
						...extractRepoAndOwner(pjson.deploy.webApp.repository),
						branch: pjson.deploy.webApp.branch ?? 'saga',
					},
				})
			},
		})
	}
}
