import { aws_lambda as Lambda } from 'aws-cdk-lib'

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
