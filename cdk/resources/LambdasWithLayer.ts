import type * as Lambda from 'aws-cdk-lib/aws-lambda'
import type { PackedLambda } from '../helper/lambdas/packLambda.js'

export type LambdasWithLayer<
	A extends {
		[key: string]: PackedLambda
	},
> = {
	lambdas: {
		[P in keyof A]: PackedLambda
	}
	layers: Lambda.ILayerVersion[]
}
