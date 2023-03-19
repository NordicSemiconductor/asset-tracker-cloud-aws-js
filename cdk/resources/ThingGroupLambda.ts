import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import type { CDKLambdas } from '../stacks/AssetTracker/lambdas.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import type { LambdasWithLayer } from './LambdasWithLayer.js'
import { logToCloudWatch } from './logToCloudWatch.js'

export class ThingGroupLambda extends CloudFormation.Resource {
	public readonly function: Lambda.IFunction
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cdkLambdas,
		}: {
			cdkLambdas: LambdasWithLayer<CDKLambdas['lambdas']>
		},
	) {
		super(parent, id)

		this.function = new Lambda.Function(this, 'createThingGroup', {
			code: Lambda.Code.fromAsset(cdkLambdas.lambdas.createThingGroup.zipFile),
			layers: cdkLambdas.layers,
			description:
				'Used in CloudFormation to create the thing group for the devices',
			handler: cdkLambdas.lambdas.createThingGroup.handler,
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_18_X,
			timeout: CloudFormation.Duration.minutes(1),
			initialPolicy: [
				new IAM.PolicyStatement({
					resources: ['*'],
					actions: ['iot:*'],
				}),
				logToCloudWatch,
			],
		})

		new LambdaLogGroup(this, 'Logs', this.function)
	}
}
