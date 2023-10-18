import { gpsDay } from './gpsTime.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('GPS epoch time functions', () => {
	void it('should calculate the GPS epoch day', () => {
		assert.equal(gpsDay(new Date('2021-08-05T12:00:00Z')), 15188)
	})
})
