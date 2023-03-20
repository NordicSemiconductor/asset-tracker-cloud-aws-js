import { toQueryString } from './apiclient.js'

describe('nRF Cloud API client', () => {
	it('should encode query strings', () =>
		expect(
			toQueryString({
				eci: 21626624,
				tac: 30401,
				requestType: 'custom',
				mcc: 242,
				mnc: 1,
				customTypes: [1, 2, 3, 4, 6, 7, 8, 9],
			}),
		).toEqual(
			'?eci=21626624&tac=30401&requestType=custom&mcc=242&mnc=1&customTypes=1,2,3,4,6,7,8,9',
		))
})
