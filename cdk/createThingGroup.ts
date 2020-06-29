import { Iot } from 'aws-sdk'
import * as response from 'cfn-response'
import { Context, CloudFormationCustomResourceEvent } from 'aws-lambda'
import { paginate } from '../util/paginate'

const iot = new Iot()

export const handler = async (
	event: CloudFormationCustomResourceEvent,
	context: Context,
): Promise<void> => {
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

	let resolve: () => void
	let reject: (reason?: any) => void
	const p = new Promise<void>((onResult, onError) => {
		resolve = onResult
		reject = onError
	})
	const doneWithPromise = (error?: Error, result?: any) => {
		context.done(error, result)
		if (error) reject(error)
		resolve()
	}
	if (RequestType === 'Create') {
		await iot
			.createThingGroup({
				thingGroupName: ThingGroupName,
				thingGroupProperties: ThingGroupProperties,
			})
			.promise()
			.then(async ({ thingGroupArn }) => {
				if (thingGroupArn === undefined) {
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
						(things ?? []).map(async ({ thingName }) =>
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
				await response.send(
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
			.catch(async (err) => {
				await response.send(
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
			paginator: async (nextToken) =>
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
							things?.map(async (thing) =>
								iot
									.listThingPrincipals({
										thingName: thing,
									})
									.promise()
									.then(async ({ principals }) =>
										Promise.all(
											principals?.map(async (principal) => {
												const principalId = principal.split('/').pop() as string
												console.log(
													`Detaching certificate ${principal} from thing ${thing} ...`,
												)
												console.log(
													`Marking certificate ${principalId} as INACTIVE`,
												)
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
														.then(async () => {
															console.log(`Deleting certificate ${principalId}`)
															return iot
																.deleteCertificate({
																	certificateId: principalId,
																})
																.promise()
														}),
												])
											}) ?? [],
										),
									)
									.then(async () => {
										console.log(`Deleting thing ${thing}...`)
										return iot
											.deleteThing({
												thingName: thing,
											})
											.promise()
									}),
							) ?? [],
						)
						return nextToken
					}),
		})
		console.log(`${RequestType} not supported.`)
		await response.send(
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
