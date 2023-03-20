import { parseMCCMNC } from './parseMCCMNC.js'

describe('parseMCCMNC()', () => {
	it.each([
		[310410, 310, 410],
		[24201, 242, 1],
	])('should parse the MCCMNC %d into MNC %d and MCC %d', (mccmnc, mcc, mnc) =>
		expect(parseMCCMNC(mccmnc)).toEqual([mcc, mnc]),
	)
})
