import { cacheKey } from './cacheKey.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('cacheKey', () => {
	void it('should create a cache key', () =>
		assert.equal(
			cacheKey({
				binHours: 1,
				request: {
					mcc: 242,
					mnc: 1,
					cell: 21626624,
					area: 30401,
					types: [1, 2, 3, 4, 6, 7, 8, 9],
				},
			}),
			`242-1-21626624-30401-1_2_3_4_6_7_8_9-${new Date()
				.toISOString()
				.slice(0, 13)
				.replace(/[:-]/g, '')}0000`,
		))
})
