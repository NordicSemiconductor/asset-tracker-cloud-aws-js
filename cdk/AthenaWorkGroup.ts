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
		ResourceProperties: { WorkGroupName, QueryResultsBucketName },
	} = event
	if (RequestType === 'Create') {
		athena
			.createWorkGroup({
				Name: WorkGroupName,
				Description: 'Workgroup for Bifravst',
				Configuration: {
					ResultConfiguration: {
						OutputLocation: `s3://${QueryResultsBucketName}/`,
					},
				},
			})
			.promise()
			.then(() => {
				response.send(
					event,
					context,
					response.SUCCESS,
					{ WorkGroupName },
					WorkGroupName,
				)
			})
			.catch(err => {
				response.send(event, context, response.FAILED, {
					Error: `${err.message}  (${err})`,
				})
			})
	} else if (RequestType === 'Delete') {
		athena
			.deleteWorkGroup({
				WorkGroup: WorkGroupName,
				RecursiveDeleteOption: true,
			})
			.promise()
			.then(() => {
				response.send(
					event,
					context,
					response.SUCCESS,
					{ WorkGroupName },
					WorkGroupName,
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
