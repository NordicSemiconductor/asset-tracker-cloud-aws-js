import { parseMCCMNC } from './parseMCCMNC.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('parseMCCMNC()', () => {
	for (const [mccmnc, mcc, mnc] of [
		[310410, 310, 410],
		[24201, 242, 1],
	] as [number, number, number][]) {
		void it(`should parse the MCCMNC ${mccmnc} into MNC ${mnc} and MCC ${mcc}`, () =>
			assert.deepEqual(parseMCCMNC(mccmnc), [mcc, mnc]))
	}
})
