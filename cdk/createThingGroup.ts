import { Iot } from 'aws-sdk'
import * as response from 'cfn-response'
import { Context, CloudFormationCustomResourceEvent } from 'aws-lambda'

const iot = new Iot()

export const handler = (
	event: CloudFormationCustomResourceEvent,
	context: Context,
) => {
	const {
		RequestType,
		ResourceProperties: { ThingGroupName, ThingGroupProperties, PolicyName },
	} = event
	if (RequestType === 'Create') {
		iot
			.createThingGroup({
				thingGroupName: ThingGroupName,
				thingGroupProperties: ThingGroupProperties,
			})
			.promise()
			.then(async ({ thingGroupArn }) => {
				if (!thingGroupArn) {
					throw new Error(`Failed to create thing group ${ThingGroupName}!`)
				}
				await iot
					.attachPolicy({
						policyName: PolicyName,
						target: thingGroupArn,
					})
					.promise()

				// Attach all existing Things to the group
				const { things } = await iot.listThings({
				}).promise()

				await Promise.all((things || []).map(({ thingName }) => iot.addThingToThingGroup({
					thingName,
					thingGroupArn
				}).promise()))
			})
			.then(() => {
				response.send(
					event,
					context,
					response.SUCCESS,
					{ ThingGroupName },
					ThingGroupName,
				)
			})
			.catch(err => {
				response.send(event, context, response.FAILED, {
					Error: `${err.message}  (${err})`,
				})
			})
	} else {
		console.log(`${RequestType} not supported.`)
		response.send(
			event,
			context,
			response.SUCCESS,
			{ ThingGroupName },
			ThingGroupName,
		)
	}
}
