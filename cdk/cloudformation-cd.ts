import { BifravstContinuousDeploymentApp } from './BifravstContinuousDeploymentApp'
import { readFileSync } from 'fs'
import * as path from 'path'
import { extractRepoAndOwner } from './helper/extract-repo-and-owner'

const STACK_ID = process.env.STACK_ID || 'bifravst'

const pjson = JSON.parse(
	readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
)

new BifravstContinuousDeploymentApp({
	stackId: `${STACK_ID}-continuous-deployment`,
	...extractRepoAndOwner(pjson.repository.url),
	branch: pjson.deploy.branch || 'saga',
}).synth()
