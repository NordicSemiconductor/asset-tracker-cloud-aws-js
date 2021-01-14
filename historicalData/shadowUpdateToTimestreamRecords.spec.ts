import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords.js'
import { TestRunner } from '../test-runner'
import hamjest from 'hamjest'
const {
	assertThat,
	is,
	equalTo,
	hasItem,
	hasProperty,
	hasProperties,
	hasItems,
	matchesPattern,
} = hamjest

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('shadowUpdateToTimestreamRecords()', ({ test: it }) => {
		it('should convert a shadow update to Timestream records', () => {
			const result = shadowUpdateToTimestreamRecords({
				reported: {
					cfg: {
						act: false,
						actwt: 60,
						mvres: 300,
						mvt: 3600,
						gpst: 60,
						celt: 600,
						acct: 0.5,
					},
					dev: {
						v: {
							band: 666,
							nw: 'LAN',
							modV: 'device-simulator',
							brdV: 'device-simulator',
							appV: '0.0.0-development',
							iccid: '12345678901234567890',
						},
						ts: 1606395292763,
					},
					roam: {
						v: {
							rsrp: 70,
							area: 30401,
							mccmnc: 24201,
							cell: 16964098,
							ip: '0.0.0.0',
						},
						ts: 1606395292763,
					},
				},
				deviceId: 'slipslop-particle-santalum',
			})

			const expected = [
				{
					MeasureName: 'dev.band',
					MeasureValue: '666',
					MeasureValueType: 'DOUBLE',
					Time: '1606395292763',
				},
				{
					MeasureName: 'dev.nw',
					MeasureValue: 'LAN',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
				},
				{
					MeasureName: 'dev.modV',
					MeasureValue: 'device-simulator',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
				},
				{
					MeasureName: 'dev.brdV',
					MeasureValue: 'device-simulator',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
				},
				{
					MeasureName: 'dev.appV',
					MeasureValue: '0.0.0-development',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
				},
				{
					MeasureName: 'dev.iccid',
					MeasureValue: '12345678901234567890',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
				},
				{
					MeasureName: 'roam.rsrp',
					MeasureValue: '70',
					MeasureValueType: 'DOUBLE',
					Time: '1606395292763',
				},
				{
					MeasureName: 'roam.area',
					MeasureValue: '30401',
					MeasureValueType: 'DOUBLE',
					Time: '1606395292763',
				},
				{
					MeasureName: 'roam.mccmnc',
					MeasureValue: '24201',
					MeasureValueType: 'DOUBLE',
					Time: '1606395292763',
				},
				{
					MeasureName: 'roam.cell',
					MeasureValue: '16964098',
					MeasureValueType: 'DOUBLE',
					Time: '1606395292763',
				},
				{
					MeasureName: 'roam.ip',
					MeasureValue: '0.0.0.0',
					MeasureValueType: 'VARCHAR',
					Time: '1606395292763',
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

			const first = result[0].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			const last = result[result.length - 1].Dimensions?.find(
				({ Name }) => Name === 'measureGroup',
			)
			// measureGroups should be equal for measures
			assertThat(first?.Value, is(equalTo(last?.Value)))
		})
	})
}
