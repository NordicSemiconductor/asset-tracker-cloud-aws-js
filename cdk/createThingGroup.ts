import {
	AddThingToThingGroupCommand,
	AttachPolicyCommand,
	CreateThingGroupCommand,
	DeleteCertificateCommand,
	DeleteThingCommand,
	DetachThingPrincipalCommand,
	IoTClient,
	ListThingPrincipalsCommand,
	ListThingsCommand,
	ListThingsInThingGroupCommand,
	UpdateCertificateCommand,
} from '@aws-sdk/client-iot'
import {
	ResponseStatus,
	cfnResponse,
} from '@nordicsemiconductor/cloudformation-helpers'
import type { CloudFormationCustomResourceEvent } from 'aws-lambda'
import { paginate } from '../util/paginate.js'

const iot = new IoTClient({})

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
			const { thingGroupArn } = await iot.send(
				new CreateThingGroupCommand({
					thingGroupName: ThingGroupName,
					thingGroupProperties: ThingGroupProperties,
				}),
			)
			if (thingGroupArn === null || thingGroupArn === undefined) {
				throw new Error(`Failed to create thing group ${ThingGroupName}!`)
			}
			await iot.send(
				new AttachPolicyCommand({
					policyName: PolicyName,
					target: thingGroupArn,
				}),
			)

			// Attach all existing Things to the group
			const { things } = await iot.send(new ListThingsCommand({}))
			if (AddExisting === '1') {
				// Add exisiting Things to the new group
				await Promise.all(
					(things ?? []).map(async ({ thingName }) =>
						iot.send(
							new AddThingToThingGroupCommand({
								thingName,
								thingGroupArn,
							}),
						),
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
					const { things, nextToken: n } = await iot.send(
						new ListThingsInThingGroupCommand({
							thingGroupName: ThingGroupName,
							nextToken,
						}),
					)

					// Detach all the certificates, deactivate and delete them
					// then delete the device
					await Promise.all(
						things?.map(async (thing) => {
							const { principals } = await iot.send(
								new ListThingPrincipalsCommand({
									thingName: thing,
								}),
							)

							await Promise.all(
								principals?.map(async (principal) => {
									const principalId = principal.split('/').pop() as string
									console.log(
										`Detaching certificate ${principal} from thing ${thing} ...`,
									)
									console.log(`Marking certificate ${principalId} as INACTIVE`)
									await iot.send(
										new DetachThingPrincipalCommand({
											thingName: thing,
											principal,
										}),
									)

									await iot.send(
										new UpdateCertificateCommand({
											certificateId: principalId,
											newStatus: 'INACTIVE',
										}),
									)

									console.log(`Deleting certificate ${principalId}`)
									await iot.send(
										new DeleteCertificateCommand({
											certificateId: principalId,
										}),
									)
								}) ?? [],
							)

							console.log(`Deleting thing ${thing}...`)
							await iot.send(
								new DeleteThingCommand({
									thingName: thing,
								}),
							)
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
			Reason: (err as Error).message,
			event,
			PhysicalResourceId: ThingGroupName,
		})
	}
}
