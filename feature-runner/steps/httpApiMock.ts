import {
	StepRunnerFunc,
	InterpolatedStep,
	regexGroupMatcher,
} from '@nordicsemiconductor/e2e-bdd-test-runner'
import { AssetTrackerWorld } from '../run-features'
import {
	DeleteMessageCommand,
	ReceiveMessageCommand,
	SendMessageCommand,
	SQSClient,
} from '@aws-sdk/client-sqs'
import { v4 } from 'uuid'
import { expect } from 'chai'

export const httpApiMockStepRunners = ({
	sqs,
}: {
	sqs: SQSClient
}): ((
	step: InterpolatedStep,
) => StepRunnerFunc<AssetTrackerWorld> | false)[] => {
	return [
		regexGroupMatcher<AssetTrackerWorld>(
			/^I enqueue this mock HTTP API response with status code (?<statusCode>[0-9]+) for a (?<method>[A-Z]+) request to (?<path>.+)$/,
		)(async ({ statusCode, method, path }, step, runner) => {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			await sqs.send(
				new SendMessageCommand({
					MessageBody: JSON.stringify(JSON.parse(step.interpolatedArgument)),
					QueueUrl: runner.world['httpApiMock:responseQueueURL'],
					MessageGroupId: v4(),
					MessageDeduplicationId: v4(),
					MessageAttributes: {
						statusCode: {
							DataType: 'String',
							StringValue: statusCode,
						},
						path: {
							DataType: 'String',
							StringValue: path,
						},
						method: {
							DataType: 'String',
							StringValue: method,
						},
					},
				}),
			)
		}),
		regexGroupMatcher<AssetTrackerWorld>(
			/^the mock HTTP API should have been called with a (?<method>[A-Z]+) request to (?<path>.+)$/,
		)(async ({ method, path }, step, runner) => {
			let expectedBody: Record<string, any> | undefined = undefined
			if (step.interpolatedArgument !== undefined) {
				expectedBody = JSON.parse(step.interpolatedArgument)
			}

			const { Messages } = await sqs.send(
				new ReceiveMessageCommand({
					QueueUrl: runner.world['httpApiMock:requestQueueURL'],
					VisibilityTimeout: 1,
					MessageAttributeNames: ['method', 'path'],
					MaxNumberOfMessages: 10,
				}),
			)
			if (Messages === undefined)
				throw new Error('No messages in request queue!')
			for (const msg of Messages) {
				if (
					msg.MessageAttributes?.path?.StringValue === path &&
					msg.MessageAttributes?.method?.StringValue === method
				) {
					try {
						if (expectedBody !== undefined) {
							const actual = JSON.parse(msg.Body as string)
							expect(actual).to.deep.equal(expectedBody)
						}
						await sqs.send(
							new DeleteMessageCommand({
								QueueUrl: runner.world['httpApiMock:requestQueueURL'],
								ReceiptHandle: msg.ReceiptHandle,
							}),
						)
						return
					} catch {
						// Ignore this, there could be multiple messages in the queue that do not match
					}
				}
			}
			throw new Error('No requests matched.')
		}),
	]
}
