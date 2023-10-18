import { batchToTimestreamRecords } from './batchToTimestreamRecords.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import { arrayContaining, check, stringMatching, withLength } from 'tsmatchers'

void describe('batchToTimestreamRecords', () => {
	void it('should convert a message to Timestream records', () => {
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
		const Dimensions = [
			{
				Name: 'measureGroup',
				Value: stringMatching(
					/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
				),
			},
		]
		check(r).is(
			withLength(4)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'gnss.lng',
						MeasureValue: '8.669555',
						MeasureValueType: 'DOUBLE',
						Time: '1606483136657',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'gnss.lat',
						MeasureValue: '50.109177',
						MeasureValueType: 'DOUBLE',
						Time: '1606483136657',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'gnss.lng',
						MeasureValue: '10.424793',
						MeasureValueType: 'DOUBLE',
						Time: '1606483256659',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'gnss.lat',
						MeasureValue: '63.422975',
						MeasureValueType: 'DOUBLE',
						Time: '1606483256659',
						TimeUnit: 'MILLISECONDS',
					}),
				),
		)

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
		assert.equal(g1lng?.Value, g1lat?.Value)
		assert.equal(g2lng?.Value, g2lat?.Value)
		// measureGroups should equal different for each batch messages
		assert.notEqual(g1lng?.Value, g2lng?.Value)
	})
	void it('should convert a batch message with a single value', () => {
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
		check(r).is(
			withLength(1).and(
				arrayContaining({
					Dimensions: [
						{
							Name: 'measureGroup',
							Value: stringMatching(
								/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
							),
						},
					],
					MeasureName: 'bat',
					MeasureValue: '4460',
					MeasureValueType: 'DOUBLE',
					Time: '1614959974018',
					TimeUnit: 'MILLISECONDS',
				}),
			),
		)
	})
})
