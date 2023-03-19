import * as CloudFormation from 'aws-cdk-lib'
import type * as Lambda from 'aws-cdk-lib/aws-lambda'
import type { Construct } from 'constructs'

export class ThingGroup extends CloudFormation.Resource {
	public constructor(
		parent: Construct,
		id: string,
		{
			thingGroupLambda,
			name,
			description,
			addExisting,
			PolicyName,
		}: {
			thingGroupLambda: Lambda.IFunction
			name: string
			description: string
			PolicyName: string
			addExisting?: boolean
		},
	) {
		super(parent, id)

		new CloudFormation.CustomResource(this, 'ThingGroup', {
			serviceToken: thingGroupLambda.functionArn,
			properties: {
				ThingGroupName: name,
				ThingGroupProperties: {
					thingGroupDescription: description,
				},
				PolicyName,
				AddExisting: addExisting === true,
			},
		})
	}
}
