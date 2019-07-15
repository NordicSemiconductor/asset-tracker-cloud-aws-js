import { BifravstContinuousDeploymentApp } from './BifravstContinuousDeploymentApp'
import { readFileSync } from 'fs'
import { parse } from 'url'
import * as path from 'path'

const STACK_ID = process.env.STACK_ID || 'bifravst'

const pjson = JSON.parse(
	readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'),
)
const repoUrl = parse(pjson.repository.url)
if (!repoUrl.path) {
	throw new Error(`Could not find path in repository.url!`)
}
const Owner = repoUrl.path.split('/')[1]
const Repo = repoUrl.path.split('/')[2].replace(/\..+$/, '')

new BifravstContinuousDeploymentApp({
	stackId: `${STACK_ID}-ci`,
	owner: Owner,
	repo: Repo,
}).synth()
