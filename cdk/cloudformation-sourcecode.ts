import { LambdaSourceCodeStorageApp } from './apps/LambdaSourceCodeStorage'
import { stackId } from './stacks/stackId'

new LambdaSourceCodeStorageApp({
	stackId: stackId('sourcecode'),
}).synth()
