import { Iot } from 'aws-sdk'
import * as response from 'cfn-response'
import { Context, CloudFormationCustomResourceEvent } from 'aws-lambda'

const iot = new Iot()

export const handler = async (
	event: CloudFormationCustomResourceEvent,
	context: Context,
) => {
	console.log(JSON.stringify({
		event
	}))

	const {
		RequestType,
		ResourceProperties: { ThingGroupName, ThingGroupProperties, PolicyName, AddExisitingThingsToGroup },
	} = event

	let resolve: (result?: unknown) => void
	let reject: (reason?: any) => void
	const p = new Promise((onResult, onError) => {
		resolve = onResult
		reject = onError
	})
	const doneWithPromise = (error?: Error, result?: any) => {
		context.done(error, result)
		if (error) reject(error)
		resolve(result)
	}
	if (RequestType === 'Create') {
		await iot
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

				if (AddExisitingThingsToGroup) {
					// Add exisiting Things to the new group
					await Promise.all((things || []).map(({ thingName }) => iot.addThingToThingGroup({
						thingName,
						thingGroupArn
					}).promise()))
				}
			})
			.then(() => {
				response.send(
					event,
					{
						...context,
						done: doneWithPromise
					},
					response.SUCCESS,
					{ ThingGroupName },
					ThingGroupName,
				)
				return p
			})
			.catch(err => {
				response.send(
					event,
					{
						...context,
						done: doneWithPromise
					},
					response.FAILED,
					{
						Error: `${err.message}  (${err})`,
					})
				return p
			})
	} else {
		console.log(`${RequestType} not supported.`)
		response.send(
			event,
			{
				...context,
				done: doneWithPromise
			},
			response.SUCCESS,
			{ ThingGroupName },
			ThingGroupName,
		)
		return p
	}
}
