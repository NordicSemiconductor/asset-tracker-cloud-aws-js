import * as nock from 'nock'
import * as url from 'url'
import {
	customResourceResponse,
	ResponseStatus,
} from './customResourceResponse'

describe('customResourceResponse', () => {
	it('should send request', async () => {
		const e = {
			RequestType: 'Update',
			ServiceToken:
				'arn:aws:lambda:eu-central-1:777112256734:function:bifravst-createThingGroup4D49793B-1I9X0QULGW8G0',
			ResponseURL:
				'https://cloudformation-custom-resource-response-eucentral1.s3.eu-central-1.amazonaws.com/arn%3Aaws%3Acloudformation%3Aeu-central-1%3A777112256734%3Astack/bifravst/b1e2b1a0-0622-11ea-959f-0656ae9cb4fa%7CThingGroupResource%7Cf4f6e7d0-7adb-441e-ae4f-96a69cb5daf5?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20200629T203715Z&X-Amz-SignedHeaders=host&X-Amz-Expires=7200&X-Amz-Credential=AKIAYYGVRKE7NNEJGHTU%2F20200629%2Feu-central-1%2Fs3%2Faws4_request&X-Amz-Signature=c44417c134f976dd6bc8c63460a4ca3858925c0a0fadaa9dd4bd8583db7e3296',
			StackId:
				'arn:aws:cloudformation:eu-central-1:777112256734:stack/bifravst/b1e2b1a0-0622-11ea-959f-0656ae9cb4fa',
			RequestId: 'f4f6e7d0-7adb-441e-ae4f-96a69cb5daf5',
			LogicalResourceId: 'ThingGroupResource',
			PhysicalResourceId: 'bifravst',
			ResourceType: 'AWS::CloudFormation::CustomResource',
			ResourceProperties: {
				ServiceToken:
					'arn:aws:lambda:eu-central-1:777112256734:function:bifravst-createThingGroup4D49793B-1I9X0QULGW8G0',
				AddExisitingThingsToGroup: '0',
				ThingGroupName: 'bifravst',
				ThingGroupProperties: {
					thingGroupDescription: 'Group created for Bifravst Things',
				},
				PolicyName: 'bifravst-thingPolicy-GO5X1E6AE2CR',
			},
			OldResourceProperties: {
				ServiceToken:
					'arn:aws:lambda:eu-central-1:777112256734:function:bifravst-createThingGroup4D49793B-1I9X0QULGW8G0',
				AddExisitingThingsToGroup: '0',
				ThingGroupName: 'bifravst',
				ThingGroupProperties: {
					thingGroupDescription: 'Group created for Bifravst Things',
				},
				PolicyName: 'bifravst-thingPolicy-1AY0FK267BKMP',
			},
		} as const

		const parsedUrl = url.parse(e.ResponseURL)

		const scope = nock(`${parsedUrl.protocol}//${parsedUrl.host}`, {
			reqheaders: {
				'content-type': 'application/json; charset=utf-8',
				'content-length': '272',
			},
		})
			.put(parsedUrl.path as string, {
				Status: ResponseStatus.SUCCESS,
				PhysicalResourceId: e.PhysicalResourceId,
				StackId: e.StackId,
				RequestId: e.RequestId,
				LogicalResourceId: e.LogicalResourceId,
				NoEcho: false,
			})
			.reply(202, {})

		await customResourceResponse({
			Status: ResponseStatus.SUCCESS,
			PhysicalResourceId: 'bifravst',
			event: e,
		})

		expect(scope.isDone()).toBeTruthy()
	})
	afterAll(() => nock.cleanAll())
})
