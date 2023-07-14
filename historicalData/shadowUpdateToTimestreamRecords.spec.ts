import { shadowUpdateToTimestreamRecords } from './shadowUpdateToTimestreamRecords.js'

describe('shadowUpdateToTimestreamRecords', () => {
	it('should convert a shadow update to Timestream records', () => {
		const Dimensions = [
			{
				Name: 'measureGroup',
				Value: expect.stringMatching(
					/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
				),
			},
		]
		const r = shadowUpdateToTimestreamRecords({
			reported: {
				cfg: {
					act: false,
					actwt: 60,
					mvres: 300,
					mvt: 3600,
					loct: 60,
					accath: 10.5,
					accith: 5.2,
					accito: 1.7,
				},
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
			deviceId: 'slipslop-particle-santalum',
		})
		expect(r).toEqual([
			{
				Dimensions,
				MeasureName: 'dev.modV',
				MeasureValue: 'device-simulator',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'dev.brdV',
				MeasureValue: 'device-simulator',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'dev.appV',
				MeasureValue: '0.0.0-development',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'dev.iccid',
				MeasureValue: '12345678901234567890',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'dev.imei',
				MeasureValue: '352656106111232',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.band',
				MeasureValue: '666',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.nw',
				MeasureValue: 'LAN',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.rsrp',
				MeasureValue: '-97',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.area',
				MeasureValue: '30401',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.mccmnc',
				MeasureValue: '24201',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.cell',
				MeasureValue: '16964098',
				MeasureValueType: 'DOUBLE',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
			{
				Dimensions,
				MeasureName: 'roam.ip',
				MeasureValue: '0.0.0.0',
				MeasureValueType: 'VARCHAR',
				Time: '1606395292763',
				TimeUnit: 'MILLISECONDS',
			},
		])
		const first = r?.[0]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		const last = r?.[r.length - 1]?.Dimensions?.find(
			({ Name }) => Name === 'measureGroup',
		)
		// measureGroups should equal equal for measures
		expect(first?.Value).toEqual(last?.Value)
	})
})
