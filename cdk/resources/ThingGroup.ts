import * as CloudFormation from '@aws-cdk/core'
import {
	CustomResource,
	CustomResourceProvider,
} from '@aws-cdk/aws-cloudformation'
import * as Lambda from '@aws-cdk/aws-lambda'

export class ThingGroup extends CloudFormation.Resource {
	public constructor(
		parent: CloudFormation.Construct,
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

		new CustomResource(this, 'ThingGroup', {
			provider: CustomResourceProvider.lambda(thingGroupLambda),
			properties: {
				ThingGroupName: name,
				ThingGroupProperties: {
					thingGroupDescription: description,
				},
				PolicyName,
				AddExisiting: addExisting ?? false ? 0 : 1,
			},
		})
	}
}
