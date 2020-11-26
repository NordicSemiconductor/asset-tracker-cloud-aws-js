import { toTimestreamType } from './toTimestreamType'

describe('toTimestreamType', () => {
	it.each([
		[true, 'BOOLEAN'],
		[1.1, 'DOUBLE'],
		[1, 'DOUBLE'],
		['foo', 'VARCHAR'],
		['12345678901234567890', 'VARCHAR'],
	])('should determind %s as %s', (v, expected) => {
		expect(toTimestreamType(v)).toEqual(expected)
	})
})
