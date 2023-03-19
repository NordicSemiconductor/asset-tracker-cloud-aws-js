import * as Lambda from 'aws-cdk-lib/aws-lambda'
import type * as S3 from 'aws-cdk-lib/aws-s3'
import type { PackedLambdas } from '../helper/lambdas/PackedLambdas.js'

export const lambdasOnS3 =
	(sourceCodeBucket: S3.IBucket) =>
	<
		A extends {
			[key: string]: string
		},
	>(
		packedLambdas: PackedLambdas<A>,
	): {
		[P in keyof A]: Lambda.S3Code
	} =>
		Object.entries(packedLambdas.lambdas.lambdaZipFileNames).reduce(
			(o, [lambdaName, zipFileName]) => ({
				...o,
				[lambdaName]: Lambda.Code.fromBucket(sourceCodeBucket, zipFileName),
			}),
			{} as {
				[P in keyof A]: Lambda.S3Code
			},
		)
