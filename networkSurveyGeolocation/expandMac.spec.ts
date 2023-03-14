import { expandMac } from './expandMac'

describe('expandMac()', () => {
	it.each([
		['80e01d098f6e', '80:e0:1d:09:8f:6e'],
		['80:e0:1d:09:8f:6e', '80:e0:1d:09:8f:6e'],
	])('should expand the mac %s to %s', (original, expanded) =>
		expect(expandMac(original)).toEqual(expanded),
	)
})
