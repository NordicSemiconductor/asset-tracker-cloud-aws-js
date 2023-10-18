import { expandMac } from './expandMac.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('expandMac()', () => {
	for (const [original, expanded] of [
		['80e01d098f6e', '80:e0:1d:09:8f:6e'],
		['80:e0:1d:09:8f:6e', '80:e0:1d:09:8f:6e'],
	] as [string, string][]) {
		void it(`should expand the mac ${original} to ${expanded}`, () =>
			assert.equal(expandMac(original), expanded))
	}
})
