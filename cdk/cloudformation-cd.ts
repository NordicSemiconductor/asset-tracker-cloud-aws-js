import { ContinuousDeploymentApp } from './apps/ContinuousDeployment'
import { readFileSync } from 'fs'
import * as path from 'path'
import { extractRepoAndOwner } from './helper/extract-repo-and-owner'
import { stackId } from './stacks/stackId'

const pjson = JSON.parse(
	readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
)

new ContinuousDeploymentApp({
	stackId: stackId('continuous-deployment'),
	bifravstStackId: stackId(),
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
}).synth()
