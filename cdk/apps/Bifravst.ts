import { App } from '@aws-cdk/core'
import { BifravstStack } from '../stacks/Bifravst'
import { WebAppStack } from '../stacks/WebApp'
import {
	BifravstLambdas,
	CDKLambdas,
	PackedLambdas,
} from '../prepare-resources'
import { DeviceUIStack } from '../stacks/DeviceUI'
import { FirmwareCIStack } from '../stacks/FirmwareCI'
import * as path from 'path'
import { readFileSync } from 'fs'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment'
import { extractRepoAndOwner } from '../helper/extract-repo-and-owner'
import { enabledInContext } from '../helper/enabledInContext'

export class BifravstApp extends App {
	public constructor(args: {
		mqttEndpoint: string
		sourceCodeBucketName: string
		packedLambdas: PackedLambdas<BifravstLambdas>
		packedCDKLambdas: PackedLambdas<CDKLambdas>
		enableUnwiredApi: boolean
	}) {
		super()
		// Core
		new BifravstStack(this, {
			...args,
			isTest: false,
		})
		const checkFlag = enabledInContext(this.node)
		// Web App
		checkFlag({
			key: 'webapp',
			component: 'Web App',
			onUndefined: 'enabled',
			onEnabled: () => new WebAppStack(this),
		})
		// Device UI
		checkFlag({
			key: 'deviceui',
			component: 'Device UI',
			onUndefined: 'enabled',
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
					bifravstAWS: {
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
