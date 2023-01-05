/**
 * Parses to MCCMNC tuple into MCC and MNC
 */
export const parseMCCMNC = (mccmnc: number): [mnc: number, mnc: number] => {
	const s = mccmnc.toFixed(0)
	return [parseInt(s.slice(0, 3), 10), parseInt(s.slice(3), 10)]
}
