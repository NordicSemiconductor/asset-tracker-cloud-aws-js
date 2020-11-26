import { toTimestreamRecords } from './toTimestreamRecords'

describe('toTimestreamRecords', () => {
	it('should convert an event to Timestream records', () => {
		const Dimensions = [
			{ Name: 'deviceId', Value: 'slipslop-particle-santalum' },
		]
		expect(
			toTimestreamRecords({
				reported: {
					cfg: {
						act: false,
						actwt: 60,
						mvres: 300,
						mvt: 3600,
						gpst: 60,
						celt: 600,
						acct: 1,
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
				timestamp: 1606395294646,
				deviceId: 'slipslop-particle-santalum',
			}),
		).toEqual([
			{
				Dimensions,
				MeasureName: 'dev.band',
				MeasureValue: '666',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'dev.nw',
				MeasureValue: 'LAN',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'dev.modV',
				MeasureValue: 'device-simulator',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'dev.brdV',
				MeasureValue: 'device-simulator',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'dev.appV',
				MeasureValue: '0.0.0-development',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'dev.iccid',
				MeasureValue: '12345678901234567890',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'roam.rsrp',
				MeasureValue: '70',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'roam.area',
				MeasureValue: '30401',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'roam.mccmnc',
				MeasureValue: '24201',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'roam.cell',
				MeasureValue: '16964098',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
			},
			{
				Dimensions,
				MeasureName: 'roam.ip',
				MeasureValue: '0.0.0.0',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
			},
		])
	})
})
