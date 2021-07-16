import { cacheKey } from './cacheKey'

describe('cacheKey', () => {
	it('should create a cache key', () =>
		expect(
			cacheKey({
				binHours: 1,
				request: {
					nw: 'LTE-m GPS',
					mcc: 242,
					mnc: 1,
					cell: 21626624,
					area: 30401,
					types: [1, 2, 3, 4, 6, 7, 8, 9],
				},
			}),
		).toEqual(
			`ltem-242-1-21626624-30401-1,2,3,4,6,7,8,9-${new Date()
				.toISOString()
				.substr(0, 13)}:00:00.000Z`,
		))
})
