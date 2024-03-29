import { toQueryString } from './apiclient.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('nRF Cloud API client', () => {
	void it('should encode query strings', () =>
		assert.equal(
			toQueryString({
				types: [1, 2, 3, 4, 6, 7, 8, 9],
				eci: 21626624,
				tac: 30401,
				mcc: 242,
				mnc: 1,
			}),
			'?eci=21626624&mcc=242&mnc=1&tac=30401&types=1,2,3,4,6,7,8,9',
		))
})
