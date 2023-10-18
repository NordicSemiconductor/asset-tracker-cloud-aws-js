import { cellId, NetworkMode } from './cellId.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
void describe('cellId', () => {
	void it('should generate a cellId (LTE-m)', () => {
		assert.equal(
			cellId({
				nw: NetworkMode.LTEm,
				area: 42,
				mccmnc: 17,
				cell: 666,
			}),
			'ltem-666-17-42',
		)
	})
	void it('should generate a cellId (NB-IoT)', () => {
		assert.equal(
			cellId({
				nw: NetworkMode.NBIoT,
				area: 42,
				mccmnc: 17,
				cell: 666,
			}),
			'nbiot-666-17-42',
		)
	})
})
