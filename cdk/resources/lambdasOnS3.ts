import { aws_lambda as Lambda } from 'aws-cdk-lib'
import { aws_s3 as S3 } from 'aws-cdk-lib'
import { PackedLambdas } from '../helper/lambdas/PackedLambdas'

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
