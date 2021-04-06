import { App } from '@aws-cdk/core'
import { AssetTrackerStack } from '../stacks/AssetTracker/stack'
import { WebAppStack } from '../stacks/WebApp'
import { DeviceUIStack } from '../stacks/DeviceUI'
import { FirmwareCIStack } from '../stacks/FirmwareCI'
import * as path from 'path'
import { readFileSync } from 'fs'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment'
import { extractRepoAndOwner } from '../helper/extract-repo-and-owner'
import { enabledInContext } from '../helper/enabledInContext'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'
import { AssetTrackerLambdas, CDKLambdas } from '../stacks/AssetTracker/lambdas'

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
		// Device Simulator Web Application
		checkFlag({
			key: 'deviceui',
			component: 'Device Simulator Web Application',
			onEnabled: () => new DeviceUIStack(this),
		})
		// Firmware CI
		checkFlag({
			key: 'firmware-ci',
			component: 'Firmware CI',
			onEnabled: () => {
				new FirmwareCIStack(this, args)
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
					deviceUI: {
						...extractRepoAndOwner(pjson.deploy.deviceUI.repository),
						branch: pjson.deploy.deviceUI.branch ?? 'saga',
					},
				})
			},
		})
	}
}
