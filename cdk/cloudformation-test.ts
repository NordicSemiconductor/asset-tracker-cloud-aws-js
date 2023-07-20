import { TestApp } from './apps/Test.js'
import {
	prepareAssetTrackerLambdas,
	prepareCDKLambdas,
} from './stacks/AssetTracker/lambdas.js'

new TestApp({
	packedLambdas: await prepareAssetTrackerLambdas(),
	packedCDKLambdas: await prepareCDKLambdas(),
	context: {
		version: process.env.VERSION ?? '0.0.0-development',
		isTest: true,
	},
}).synth()
