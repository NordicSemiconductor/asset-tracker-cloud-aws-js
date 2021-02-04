import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as Lambda from '@aws-cdk/aws-lambda'
import { logToCloudWatch } from './logToCloudWatch'
import { CDKLambdas } from '../prepare-resources'
import { LambdasWithLayer } from './LambdasWithLayer'
import { LambdaLogGroup } from './LambdaLogGroup'

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
			// runtime: Lambda.Runtime.NODEJS_14_X, // FIXME: use once CDK has support
			runtime: new Lambda.Runtime('nodejs14.x', Lambda.RuntimeFamily.NODEJS, {
				supportsInlineCode: true,
			}),
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
