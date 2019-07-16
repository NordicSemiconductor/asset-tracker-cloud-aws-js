import { BifravstApp } from './BifravstApp'

const STACK_ID = process.env.STACK_ID || 'bifravst'

new BifravstApp({
	stackId: STACK_ID,
}).synth()
