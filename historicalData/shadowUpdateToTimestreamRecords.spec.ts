import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords.js'
import { describe, it } from 'node:test'
import { arrayContaining, check, stringMatching, withLength } from 'tsmatchers'

const Dimensions = [
	{
		Name: 'measureGroup',
		Value: stringMatching(
			/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
		),
	},
]

void describe('shadowUpdateToTimestreamRecords', () => {
	void it('should convert a shadow update to Timestream records', () => {
		const r = shadowUpdateToTimestreamRecords({
			reported: {
				dev: {
					v: {
						modV: 'device-simulator',
						brdV: 'device-simulator',
						appV: '0.0.0-development',
						iccid: '12345678901234567890',
						imei: '352656106111232',
					},
					ts: 1606395292763,
				},
				roam: {
					v: {
						band: 666,
						nw: 'LAN',
						rsrp: -97,
						area: 30401,
						mccmnc: 24201,
						cell: 16964098,
						ip: '0.0.0.0',
					},
					ts: 1606395292763,
				},
			},
		})
		check(r).is(
			withLength(12)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'dev.modV',
						MeasureValue: 'device-simulator',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'dev.brdV',
						MeasureValue: 'device-simulator',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'dev.appV',
						MeasureValue: '0.0.0-development',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'dev.iccid',
						MeasureValue: '12345678901234567890',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'dev.imei',
						MeasureValue: '352656106111232',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.band',
						MeasureValue: '666',
						MeasureValueType: 'DOUBLE',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.nw',
						MeasureValue: 'LAN',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.rsrp',
						MeasureValue: '-97',
						MeasureValueType: 'DOUBLE',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.area',
						MeasureValue: '30401',
						MeasureValueType: 'DOUBLE',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.mccmnc',
						MeasureValue: '24201',
						MeasureValueType: 'DOUBLE',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.cell',
						MeasureValue: '16964098',
						MeasureValueType: 'DOUBLE',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				)
				.and(
					arrayContaining({
						Dimensions,
						MeasureName: 'roam.ip',
						MeasureValue: '0.0.0.0',
						MeasureValueType: 'VARCHAR',
						Time: '1606395292763',
						TimeUnit: 'MILLISECONDS',
					}),
				),
		)
		const first = r?.[0]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		const last = r?.[r.length - 1]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		// measureGroups should equal equal for measures
		check(first?.Value).is(last?.Value as string)
	})

	// null values are sent by the device to remove a property from the shadow document
	void it('should ignore properties that have null values', () => {
		check(
			shadowUpdateToTimestreamRecords({
				reported: {
					fg: {
						ts: 1697156932592,
						v: {
							V: 3916,
							TTF: null,
						},
					},
				},
			}),
		).is(
			withLength(1).and(
				arrayContaining({
					Dimensions,
					MeasureName: 'fg.V',
					MeasureValue: '3916',
					MeasureValueType: 'DOUBLE',
					Time: '1697156932592',
					TimeUnit: 'MILLISECONDS',
				}),
			),
		)
	})
})
