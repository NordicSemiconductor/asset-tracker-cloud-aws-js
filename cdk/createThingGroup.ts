import { Iot } from 'aws-sdk'
import * as response from 'cfn-response'
import { Context, CloudFormationCustomResourceEvent } from 'aws-lambda'
import { paginate } from '../util/paginate'

const iot = new Iot()

export const handler = async (
	event: CloudFormationCustomResourceEvent,
	context: Context,
) => {
	console.log(
		JSON.stringify({
			event,
		}),
	)

	const {
		RequestType,
		ResourceProperties: {
			ThingGroupName,
			ThingGroupProperties,
			PolicyName,
			AddExisitingThingsToGroup,
		},
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
				const { things } = await iot.listThings({}).promise()

				if (AddExisitingThingsToGroup === '1') {
					// Add exisiting Things to the new group
					await Promise.all(
						(things || []).map(async ({ thingName }) =>
							iot
								.addThingToThingGroup({
									thingName,
									thingGroupArn,
								})
								.promise(),
						),
					)
				}
			})
			.then(async () => {
				response.send(
					event,
					{
						...context,
						done: doneWithPromise,
					},
					response.SUCCESS,
					{ ThingGroupName },
					ThingGroupName,
				)
				return p
			})
			.catch(async err => {
				response.send(
					event,
					{
						...context,
						done: doneWithPromise,
					},
					response.FAILED,
					{
						Error: `${err.message}  (${err})`,
					},
				)
				return p
			})
	} else {
		await paginate({
			paginator: async nextToken =>
				iot
					.listThingsInThingGroup({
						thingGroupName: ThingGroupName,
						nextToken,
					})
					.promise()
					.then(async ({ things, nextToken }) => {
						// Detach all the certificates, deactivate and delete them
						// then delete the device
						await Promise.all(
							things?.map(async thing =>
								iot
									.listThingPrincipals({
										thingName: thing,
									})
									.promise()
									.then(async ({ principals }) =>
										Promise.all(
											principals?.map(async principal => {
												const principalId = principal.split('/').pop() as string
												return Promise.all([
													iot
														.detachThingPrincipal({
															thingName: thing,
															principal,
														})
														.promise(),
													iot
														.updateCertificate({
															certificateId: principalId,
															newStatus: 'INACTIVE',
														})
														.promise()
														.then(async () =>
															iot
																.deleteCertificate({
																	certificateId: principalId,
																})
																.promise(),
														),
												])
											}) ?? [],
										),
									)
									.then(async () =>
										iot
											.deleteThing({
												thingName: thing,
											})
											.promise(),
									),
							) ?? [],
						)
						return nextToken
					}),
		})
		console.log(`${RequestType} not supported.`)
		response.send(
			event,
			{
				...context,
				done: doneWithPromise,
			},
			response.SUCCESS,
			{ ThingGroupName },
			ThingGroupName,
		)
		return p
	}
}
