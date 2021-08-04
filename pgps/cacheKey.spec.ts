import { cacheKey } from './cacheKey'
import { gpsDay } from './gpsTime'

describe('cacheKey', () => {
	it('should create a cache key', () =>
		expect(
			cacheKey({
				binHours: 1,
				request: {
					n: 42,
					int: 240,
					day: 15160,
					time: 40655,
				},
			}),
		).toEqual(
			`42-240-15160-40655-${new Date()
				.toISOString()
				.substr(0, 13)
				.replace(/[:-]/g, '')}0000`,
		))
	it('should create a cache key with defaults', () =>
		expect(
			cacheKey({
				request: {},
				binHours: 1,
			}),
		).toEqual(
			`42-240-${gpsDay()}-0-${new Date()
				.toISOString()
				.substr(0, 13)
				.replace(/[:-]/g, '')}0000`,
		))
})
