import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as Lambda from '@aws-cdk/aws-lambda'
import * as S3 from '@aws-cdk/aws-s3'
import { logToCloudWatch } from './logToCloudWatch'
import { LayeredLambdas } from '@bifravst/package-layered-lambdas'
import { BifravstLambdas } from '../prepare-resources'

export class ThingGroupLambda extends CloudFormation.Resource {
	public readonly function: Lambda.IFunction
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			sourceCodeBucket,
			lambdas,
			cloudFormationLayer,
		}: {
			sourceCodeBucket: S3.IBucket
			lambdas: LayeredLambdas<BifravstLambdas>
			cloudFormationLayer: Lambda.ILayerVersion
		},
	) {
		super(parent, id)

		this.function = new Lambda.Function(this, 'createThingGroup', {
			code: Lambda.Code.bucket(
				sourceCodeBucket,
				lambdas.lambdaZipFileNames.createThingGroup,
			),
			layers: [cloudFormationLayer],
			description:
				'Used in CloudFormation to create the thing group for the devices',
			handler: 'index.handler',
			runtime: Lambda.Runtime.NODEJS_12_X,
			timeout: CloudFormation.Duration.minutes(1),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['iot:*'],
				}),
				logToCloudWatch,
			],
		})
	}
}
