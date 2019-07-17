import { toObject } from './toObject'

describe('toObject()', () => {
	it('should convert CloudFormation Stack Outputs to a React App environment', () => {
		expect(
			toObject([
				{
					OutputKey: 'websiteBucketName',
					OutputValue: 'bifravst-websitbucketc74c6fbf-e126q3sws4eq',
					ExportName: 'bifravst:websiteBucketName',
				},
				{
					OutputKey: 'userPoolClientId',
					OutputValue: '7mfbudbt5eq56kgo2244sa9kc8',
					ExportName: 'bifravst:userPoolClientId',
				},
				{
					OutputKey: 'mqttEndpoint',
					OutputValue: 'a34x44yyrk96tg-ats.iot.eu-central-1.amazonaws.com',
					ExportName: 'bifravst:mqttEndpoint',
				},
				{
					OutputKey: 'userPoolId',
					OutputValue: 'eu-central-1_KBMdKxWIt',
					ExportName: 'bifravst:userPoolId',
				},
				{
					OutputKey: 'identityPoolId',
					OutputValue: 'eu-central-1:5b979419-01d8-498a-a024-c344ac2a3301',
					ExportName: 'bifravst:identityPoolId',
				},
				{
					OutputKey: 'websiteDomainName',
					OutputValue:
						'bifravst-websitbucketc74c6fbf-e126q3sws4eq.s3.eu-central-1.amazonaws.com',
					ExportName: 'bifravst:websiteDomainName',
				},
			]),
		).toEqual({
			websiteBucketName: 'bifravst-websitbucketc74c6fbf-e126q3sws4eq',
			userPoolClientId: '7mfbudbt5eq56kgo2244sa9kc8',
			mqttEndpoint: 'a34x44yyrk96tg-ats.iot.eu-central-1.amazonaws.com',
			userPoolId: 'eu-central-1_KBMdKxWIt',
			identityPoolId: 'eu-central-1:5b979419-01d8-498a-a024-c344ac2a3301',
			websiteDomainName:
				'bifravst-websitbucketc74c6fbf-e126q3sws4eq.s3.eu-central-1.amazonaws.com',
		})
	})
})
