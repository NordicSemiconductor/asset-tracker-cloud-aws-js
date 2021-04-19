import CloudFormation from '@aws-cdk/core'
import IAM from '@aws-cdk/aws-iam'
import Lambda from '@aws-cdk/aws-lambda'
import { logToCloudWatch } from './logToCloudWatch.js'
import { LambdasWithLayer } from './LambdasWithLayer.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import { NodeJS14Runtime } from './NodeJS14Runtime.js'
import { CDKLambdas } from '../stacks/AssetTracker/lambdas.js'

export class ThingGroupLambda extends CloudFormation.Resource {
	public readonly function: Lambda.IFunction
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{
			cdkLambdas,
		}: {
			cdkLambdas: LambdasWithLayer<CDKLambdas>
		},
	) {
		super(parent, id)

		this.function = new Lambda.Function(this, 'createThingGroup', {
			code: cdkLambdas.lambdas.createThingGroup,
			layers: cdkLambdas.layers,
			description:
				'Used in CloudFormation to create the thing group for the devices',
			handler: 'index.handler',
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support. See https://github.com/aws/aws-cdk/pull/12861
			runtime: NodeJS14Runtime,
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
