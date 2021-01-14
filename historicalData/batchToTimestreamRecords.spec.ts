import { batchToTimestreamRecords } from './batchToTimestreamRecords.js'
import { TestRunner } from '../test-runner'
import hamjest from 'hamjest'
const {
	assertThat,
	is,
	not,
	equalTo,
	hasItem,
	hasProperty,
	hasProperties,
	hasItems,
	matchesPattern,
} = hamjest

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('batchToTimestreamRecords()', ({ test: it }) => {
		it('should convert a message to Timestream records', () => {
			const result = batchToTimestreamRecords({
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
			const expected = [
				{
					MeasureName: 'gps.lng',
					MeasureValue: '8.669555',
					MeasureValueType: 'DOUBLE',
					Time: '1606483136657',
				},
				{
					MeasureName: 'gps.lat',
					MeasureValue: '50.109177',
					MeasureValueType: 'DOUBLE',
					Time: '1606483136657',
				},
				{
					MeasureName: 'gps.lng',
					MeasureValue: '10.424793',
					MeasureValueType: 'DOUBLE',
					Time: '1606483256659',
				},
				{
					MeasureName: 'gps.lat',
					MeasureValue: '63.422975',
					MeasureValueType: 'DOUBLE',
					Time: '1606483256659',
				},
			]

			for (const expectedEntry of expected) {
				assertThat(result, hasItem(hasProperties(expectedEntry)))
			}

			// Check that all elements have a measuregroup
			for (const resultEntry of result) {
				assertThat(
					resultEntry,
					hasProperty(
						'Dimensions',
						hasItems(
							hasProperties({
								Name: 'measureGroup',
								Value: matchesPattern(
									/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
								),
							}),
						),
					),
				)
			}

			const g1lng = result[0].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			const g1lat = result[1].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			const g2lng = result[2].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			const g2lat = result[3].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			// measureGroups should be equal for measures from the same object
			assertThat(g1lng?.Value, is(equalTo(g1lat?.Value)))
			assertThat(g2lng?.Value, is(equalTo(g2lat?.Value)))
			// measureGroups should be different for each batch messages
			assertThat(g1lng?.Value, is(not(equalTo(g2lng?.Value))))
		})
	})
}
