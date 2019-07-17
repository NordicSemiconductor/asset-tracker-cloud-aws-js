import { LambdaSourceCodeStorageApp } from './apps/LambdaSourceCodeStorage'
import { stackId } from './stacks/LambdaSourceCodeStorage'

const STACK_ID = process.env.STACK_ID || 'bifravst'

new LambdaSourceCodeStorageApp({
	stackId: stackId({ bifravstStackName: STACK_ID }),
}).synth()
