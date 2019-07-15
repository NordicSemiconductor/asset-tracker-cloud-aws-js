import { BifravstApp } from './BifravstApp'

const STACK_ID = process.env.STACK_ID || 'bifravst'
const AWS_ACCOUNT = process.env.AWS_ACCOUNT
const AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION

if (!AWS_ACCOUNT || !AWS_DEFAULT_REGION) {
	throw new Error(`Missing AWS configuration.`)
}

new BifravstApp({
	stackId: STACK_ID,
	region: AWS_DEFAULT_REGION,
	account: AWS_ACCOUNT,
}).synth()
