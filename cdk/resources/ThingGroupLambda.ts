import * as CloudFormation from 'aws-cdk-lib'
import * as IAM from 'aws-cdk-lib/aws-iam'
import * as Lambda from 'aws-cdk-lib/aws-lambda'
import { CDKLambdas } from '../stacks/AssetTracker/lambdas.js'
import { LambdaLogGroup } from './LambdaLogGroup.js'
import { LambdasWithLayer } from './LambdasWithLayer.js'
import { logToCloudWatch } from './logToCloudWatch.js'

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
			architecture: Lambda.Architecture.ARM_64,
			runtime: Lambda.Runtime.NODEJS_14_X,
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
