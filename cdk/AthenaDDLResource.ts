import { Athena } from 'aws-sdk'
import * as response from 'cfn-response'
import { Context, CloudFormationCustomResourceEvent } from 'aws-lambda'

const athena = new Athena()

export const handler = (
	event: CloudFormationCustomResourceEvent,
	context: Context,
) => {
	const {
		RequestType,
		ResourceProperties: { Create, Delete, WorkGroupName },
	} = event
	if (RequestType === 'Create') {
		athena
			.startQueryExecution({
				WorkGroup: WorkGroupName,
				QueryString: Create,
			})
			.promise()
			.then(() => {
				response.send(
					event,
					context,
					response.SUCCESS,
					{ WorkGroupName, Create },
					Create,
				)
			})
			.catch(err => {
				response.send(event, context, response.FAILED, {
					Error: `${err.message}  (${err})`,
				})
			})
	} else if (RequestType === 'Delete') {
		athena
			.startQueryExecution({
				WorkGroup: WorkGroupName,
				QueryString: Delete,
			})
			.promise()
			.then(() => {
				response.send(
					event,
					context,
					response.SUCCESS,
					{ WorkGroupName, Delete },
					Delete,
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
			{ WorkGroupName },
			WorkGroupName,
		)
	}
}
