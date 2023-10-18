import { cacheKey } from './cacheKey.js'
import { gpsDay } from './gpsTime.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('cacheKey', () => {
	void it('should create a cache key', () =>
		assert.equal(
			cacheKey({
				binHours: 1,
				request: {
					n: 42,
					int: 240,
					day: 15160,
					time: 40655,
				},
			}),
			`42-240-15160-40655-${new Date()
				.toISOString()
				.slice(0, 13)
				.replace(/[:-]/g, '')}0000`,
		))
	void it('should create a cache key with defaults', () =>
		assert.equal(
			cacheKey({
				request: {},
				binHours: 1,
			}),
			`42-240-${gpsDay()}-0-${new Date()
				.toISOString()
				.slice(0, 13)
				.replace(/[:-]/g, '')}0000`,
		))
})
