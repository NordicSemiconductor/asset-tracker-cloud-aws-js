import { batchToTimestreamRecords } from './batchToTimestreamRecords'

describe('batchToTimestreamRecords', () => {
	it('should convert a message to Timestream records', () => {
		const Dimensions = [
			{ Name: 'deviceId', Value: 'slipslop-particle-santalum' },
			{ Name: 'source', Value: 'batch' },
		]
		expect(
			batchToTimestreamRecords({
				batch: {
					gps: [
						{
							v: {
								lng: 8.669555,
								// lat: 50.109177,
								// acc: 28.032738,
								// alt: 204.623276,
								// spd: 0.698944,
								// hdg: 0,
							},
							ts: 1606483136657,
						},
						{
							v: {
								lng: 10.424793,
								//lat: 63.422975,
								//acc: 12.276645,
								//alt: 137.319351,
								//spd: 6.308265,
								//hdg: 77.472923,
							},
							ts: 1606483256659,
						},
					],
				},
				deviceId: 'slipslop-particle-santalum',
				timestamp: 1606483144934,
			}),
		).toEqual([
			{
				Dimensions,
				MeasureName: 'gps.lng',
				MeasureValue: '8.669555',
				MeasureValueType: 'DOUBLE',
				Time: '1606483136657',
			},
			{
				Dimensions,
				MeasureName: 'gps.lng',
				MeasureValue: '10.424793',
				MeasureValueType: 'DOUBLE',
				Time: '1606483256659',
			},
		])
	})
})
