import { toQueryString } from './apiclient'

describe('nRF Connect for Cloud API client', () => {
	it('should encode query strings', () =>
		expect(
			toQueryString({
				deviceIdentifier: 'nRFAssetTrackerForAWS',
				eci: 21626624,
				tac: 30401,
				requestType: 'custom',
				mcc: 242,
				mnc: 1,
				customTypes: [1, 2, 3, 4, 6, 7, 8, 9],
			}),
		).toEqual(
			'?deviceIdentifier=nRFAssetTrackerForAWS&eci=21626624&tac=30401&requestType=custom&mcc=242&mnc=1&customTypes=1,2,3,4,6,7,8,9',
		))
})
