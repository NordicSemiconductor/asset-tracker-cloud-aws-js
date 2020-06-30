import * as https from 'https'
import * as url from 'url'
import { CloudFormationCustomResourceEvent } from 'aws-lambda'

export enum ResponseStatus {
	SUCCESS = 'SUCCESS',
	FAILED = 'FAILED',
}

/**
 * Sends a custom resource provider response
 *
 * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/crpg-ref-responses.html
 */
export const customResourceResponse = async ({
	Status,
	Reason,
	PhysicalResourceId,
	event,
	NoEcho,
	Data,
}: {
	Status: ResponseStatus
	Reason?: string
	PhysicalResourceId: string
	event: CloudFormationCustomResourceEvent
	NoEcho?: boolean
	Data?: Record<string, any>
}): Promise<{
	status: {
		Status: ResponseStatus
		Reason?: string
		PhysicalResourceId: string
		StackId: string
		RequestId: string
		LogicalResourceId: string
		NoEcho: boolean
		Data?: Record<string, any>
	}
	result: { statusCode?: number; body: string }
}> => {
	if (Status === ResponseStatus.FAILED && Reason === undefined) {
		throw new Error(
			`Must provide Reason when Status is ${ResponseStatus.FAILED}`,
		)
	}
	const status = {
		Status,
		Reason,
		PhysicalResourceId,
		StackId: event.StackId,
		RequestId: event.RequestId,
		LogicalResourceId: event.LogicalResourceId,
		NoEcho: NoEcho ?? false,
		Data,
	}
	const parsedUrl = url.parse(event.ResponseURL)

	const res = await new Promise<{ statusCode?: number; body: string }>(
		(resolve, reject) => {
			const responseBody = JSON.stringify(status)

			const request = https.request(
				{
					hostname: parsedUrl.hostname,
					port: 443,
					path: parsedUrl.path,
					method: 'PUT',
					headers: {
						'content-type': 'application/json; charset=utf-8',
						'content-length': responseBody.length,
					},
				},
				(res) => {
					const data: string[] = []
					res.on('data', (chunk) => data.push(chunk))
					res.on('end', function () {
						resolve({
							statusCode: res.statusCode,
							body: data.join(''),
						})
					})
				},
			)
			request.on('error', reject)
			request.end(responseBody)
		},
	)

	return {
		status,
		result: res,
	}
}
