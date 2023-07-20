import { cellId, NetworkMode } from './cellId.js'

describe('cellId', () => {
	it('should generate a cellId (LTE-m)', () => {
		expect(
			cellId({
				nw: NetworkMode.LTEm,
				area: 42,
				mccmnc: 17,
				cell: 666,
			}),
		).toEqual('ltem-666-17-42')
	})
	it('should generate a cellId (NB-IoT)', () => {
		expect(
			cellId({
				nw: NetworkMode.NBIoT,
				area: 42,
				mccmnc: 17,
				cell: 666,
			}),
		).toEqual('nbiot-666-17-42')
	})
})
