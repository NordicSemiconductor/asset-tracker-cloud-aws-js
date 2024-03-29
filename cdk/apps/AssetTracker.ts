import { App } from 'aws-cdk-lib'
import pjson from '../../package.json'
import { enabledInContext } from '../helper/enabledInContext.js'
import { extractRepoAndOwner } from '../helper/extract-repo-and-owner.js'
import type {
	AssetTrackerLambdas,
	CDKLambdas,
} from '../stacks/AssetTracker/lambdas.js'
import { AssetTrackerStack } from '../stacks/AssetTracker/stack.js'
import { ContinuousDeploymentStack } from '../stacks/ContinuousDeployment.js'
import { WebAppStack } from '../stacks/WebApp.js'
import { WebAppCIStack } from '../stacks/WebAppCI.js'

export class AssetTrackerApp extends App {
	public constructor(args: {
		packedLambdas: AssetTrackerLambdas
		packedCDKLambdas: CDKLambdas
		context?: Record<string, any>
	}) {
		super({ context: args.context })
		// Core
		const coreStack = new AssetTrackerStack(this, {
			...args,
		})
		const checkFlag = enabledInContext(this.node)
		// Web App
		checkFlag({
			key: 'webapp',
			component: 'Web App',
			onUndefined: 'enabled',
			onEnabled: () => new WebAppStack(this).addDependency(coreStack),
		})
		// Web App CI
		checkFlag({
			key: 'web-app-ci',
			component: 'Web App CI',
			onEnabled: () => {
				new WebAppCIStack(this, {
					repository: extractRepoAndOwner(pjson.deploy.webApp.repository),
				}).addDependency(coreStack)
			},
		})
		// CD
		checkFlag({
			key: 'cd',
			component: 'Continuous Deployment',
			onEnabled: () => {
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
