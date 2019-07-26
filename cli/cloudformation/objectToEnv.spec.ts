import { objectToEnv } from './objectToEnv'
import * as os from 'os'

describe('objectToEnv()', () => {
	it('should convert and object to a React App environment', () => {
		expect(
			objectToEnv({
				websiteBucketName: 'bifravst-websitbucketc74c6fbf-e126q3sws4eq',
				userPoolClientId: '7mfbudbt5eq56kgo2244sa9kc8',
				mqttEndpoint: 'a34x44yyrk96tg-ats.iot.eu-central-1.amazonaws.com',
				userPoolId: 'eu-central-1_KBMdKxWIt',
				identityPoolId: 'eu-central-1:5b979419-01d8-498a-a024-c344ac2a3301',
				websiteDomainName:
					'bifravst-websitbucketc74c6fbf-e126q3sws4eq.s3.eu-central-1.amazonaws.com',
			}),
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
