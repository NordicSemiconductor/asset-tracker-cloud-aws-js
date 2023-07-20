import { batchToTimestreamRecords } from './batchToTimestreamRecords.js'

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
				gnss: [
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
				MeasureName: 'gnss.lng',
				MeasureValue: '8.669555',
				MeasureValueType: 'DOUBLE',
				Time: '1606483136657',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'gnss.lat',
				MeasureValue: '50.109177',
				MeasureValueType: 'DOUBLE',
				Time: '1606483136657',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'gnss.lng',
				MeasureValue: '10.424793',
				MeasureValueType: 'DOUBLE',
				Time: '1606483256659',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'gnss.lat',
				MeasureValue: '63.422975',
				MeasureValueType: 'DOUBLE',
				Time: '1606483256659',
				TimeUnit: 'MILLISECONDS',
			},
		])

		const g1lng = r?.[0]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		const g1lat = r?.[1]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		const g2lng = r?.[2]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		const g2lat = r?.[3]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		// measureGroups should equal equal for measures from the same object
		expect(g1lng?.Value).toEqual(g1lat?.Value)
		expect(g2lng?.Value).toEqual(g2lat?.Value)
		// measureGroups should equal different for each batch messages
		expect(g1lng?.Value).not.toEqual(g2lng?.Value)
	})
	it('should convert a batch message with a single value', () => {
		const r = batchToTimestreamRecords({
			batch: {
				bat: [
					{
						v: 4460,
						ts: 1614959974018,
					},
				],
			},
			deviceId: '352656100248049',
		})
		const Dimensions = [
			{
				Name: 'measureGroup',
				Value: expect.stringMatching(
					/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
				),
			},
		]
		expect(r).toEqual([
			{
				Dimensions,
				MeasureName: 'bat',
				MeasureValue: '4460',
				MeasureValueType: 'DOUBLE',
				Time: '1614959974018',
				TimeUnit: 'MILLISECONDS',
			},
		])
	})
})
