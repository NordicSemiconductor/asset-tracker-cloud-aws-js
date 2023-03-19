import type * as Lambda from 'aws-cdk-lib/aws-lambda'

export type LambdasWithLayer<
	A extends {
		[key: string]: string
	},
> = {
	lambdas: {
		[P in keyof A]: Lambda.S3Code
	}
	layers: Lambda.ILayerVersion[]
}
