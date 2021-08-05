import { gpsDay } from './gpsTime'

describe('GPS epoch time functions', () => {
	it('should calculate the GPS epoch day', () => {
		expect(gpsDay(new Date('2021-08-05T12:00:00Z'))).toEqual(15188)
	})
})
