import { batchToTimestreamRecords } from './batchToTimestreamRecords'

describe('batchToTimestreamRecords', () => {
	it('should convert a message to Timestream records', () => {
		const Dimensions = [
			{
				Name: 'measureGroup',
				Value: expect.stringMatching(
					/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
				),
			},
		]
		const r = batchToTimestreamRecords({
			batch: {
				gps: [
					{
						v: {
							lng: 8.669555,
							lat: 50.109177,
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
							lat: 63.422975,
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
		})
		expect(r).toEqual([
			{
				Dimensions,
				MeasureName: 'gps.lng',
				MeasureValue: '8.669555',
				MeasureValueType: 'DOUBLE',
				Time: '1606483136657',
			},
			{
				Dimensions,
				MeasureName: 'gps.lat',
				MeasureValue: '50.109177',
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
			{
				Dimensions,
				MeasureName: 'gps.lat',
				MeasureValue: '63.422975',
				MeasureValueType: 'DOUBLE',
				Time: '1606483256659',
			},
		])

		const g1lng = r[0].Dimensions?.find(({ Name }) => Name === 'measureGroup')
		const g1lat = r[1].Dimensions?.find(({ Name }) => Name === 'measureGroup')
		const g2lng = r[2].Dimensions?.find(({ Name }) => Name === 'measureGroup')
		const g2lat = r[3].Dimensions?.find(({ Name }) => Name === 'measureGroup')
		// measureGroups should be equal for measures from the same object
		expect(g1lng?.Value).toEqual(g1lat?.Value)
		expect(g2lng?.Value).toEqual(g2lat?.Value)
		// measureGroups should be different for each batch messages
		expect(g1lng?.Value).not.toEqual(g2lng?.Value)
	})
})
