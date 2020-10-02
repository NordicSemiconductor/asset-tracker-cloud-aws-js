import * as CloudFormation from '@aws-cdk/core'
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

		new CloudFormation.CustomResource(this, 'ThingGroup', {
			serviceToken: thingGroupLambda.functionArn,
			properties: {
				ThingGroupName: name,
				ThingGroupProperties: {
					thingGroupDescription: description,
				},
				PolicyName,
				AddExisting: addExisting ?? false ? 0 : 1,
			},
		})
	}
}
