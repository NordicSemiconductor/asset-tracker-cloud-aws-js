import { Iot } from 'aws-sdk'
import { CloudFormationCustomResourceEvent } from 'aws-lambda'
import { paginate } from '../util/paginate'
import { cfnResponse, ResponseStatus } from '@bifravst/cloudformation-helpers'

const iot = new Iot()

export const handler = async (
	event: CloudFormationCustomResourceEvent,
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
			AddExisting,
		},
	} = event

	try {
		if (RequestType === 'Create') {
			const { thingGroupArn } = await iot
				.createThingGroup({
					thingGroupName: ThingGroupName,
					thingGroupProperties: ThingGroupProperties,
				})
				.promise()
			if (thingGroupArn === null || thingGroupArn === undefined) {
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
			if (AddExisting === '1') {
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
			await cfnResponse({
				Status: ResponseStatus.SUCCESS,
				event,
				PhysicalResourceId: ThingGroupName,
			})
		} else if (RequestType === 'Delete') {
			await paginate({
				paginator: async (nextToken) => {
					const { things, nextToken: n } = await iot
						.listThingsInThingGroup({
							thingGroupName: ThingGroupName,
							nextToken,
						})
						.promise()
					// Detach all the certificates, deactivate and delete them
					// then delete the device
					await Promise.all(
						things?.map(async (thing) => {
							const { principals } = await iot
								.listThingPrincipals({
									thingName: thing,
								})
								.promise()

							await Promise.all(
								principals?.map(async (principal) => {
									const principalId = principal.split('/').pop() as string
									console.log(
										`Detaching certificate ${principal} from thing ${thing} ...`,
									)
									console.log(`Marking certificate ${principalId} as INACTIVE`)
									await iot
										.detachThingPrincipal({
											thingName: thing,
											principal,
										})
										.promise()
									await iot
										.updateCertificate({
											certificateId: principalId,
											newStatus: 'INACTIVE',
										})
										.promise()
									console.log(`Deleting certificate ${principalId}`)
									await iot
										.deleteCertificate({
											certificateId: principalId,
										})
										.promise()
								}) ?? [],
							)

							console.log(`Deleting thing ${thing}...`)
							await iot
								.deleteThing({
									thingName: thing,
								})
								.promise()
						}) ?? [],
					)
					return n
				},
			})
			await cfnResponse({
				Status: ResponseStatus.SUCCESS,
				event,
				PhysicalResourceId: ThingGroupName,
			})
		} else {
			console.log(`${RequestType} not supported.`)
			await cfnResponse({
				Status: ResponseStatus.SUCCESS,
				event,
				PhysicalResourceId: ThingGroupName,
				Reason: `${RequestType} not supported.`,
			})
		}
	} catch (err) {
		await cfnResponse({
			Status: ResponseStatus.FAILED,
			Reason: err.message,
			event,
			PhysicalResourceId: ThingGroupName,
		})
	}
}
