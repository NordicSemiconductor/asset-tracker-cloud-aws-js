import { toEnv } from './toEnv'
import * as os from 'os'

describe('toEnv()', () => {
	it('should convert CloudFormation Stack Outputs to a React App environment', () => {
		expect(
			toEnv([
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
		).toEqual(
			[
				'REACT_APP_WEBSITE_BUCKET_NAME=bifravst-websitbucketc74c6fbf-e126q3sws4eq',
				'REACT_APP_USER_POOL_CLIENT_ID=7mfbudbt5eq56kgo2244sa9kc8',
				'REACT_APP_MQTT_ENDPOINT=a34x44yyrk96tg-ats.iot.eu-central-1.amazonaws.com',
				'REACT_APP_USER_POOL_ID=eu-central-1_KBMdKxWIt',
				'REACT_APP_IDENTITY_POOL_ID=eu-central-1:5b979419-01d8-498a-a024-c344ac2a3301',
				'REACT_APP_WEBSITE_DOMAIN_NAME=bifravst-websitbucketc74c6fbf-e126q3sws4eq.s3.eu-central-1.amazonaws.com',
				'',
			].join(os.EOL),
		)
	})
})
