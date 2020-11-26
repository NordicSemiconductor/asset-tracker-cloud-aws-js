import { messageToTimestreamRecords } from './messageToTimestreamRecords'

describe('messageToTimestreamRecords', () => {
	it('should convert a message to Timestream records', () => {
		const Dimensions = [
			{ Name: 'deviceId', Value: 'slipslop-particle-santalum' },
		]
		expect(
			messageToTimestreamRecords({
				message: {
					btn: {
						v: 0,
						ts: 1606474470069,
					},
				},
				timestamp: 1606474470615,
				deviceId: 'slipslop-particle-santalum',
			}),
		).toEqual([
			{
				Dimensions,
				MeasureName: 'btn',
				MeasureValue: '0',
				MeasureValueType: 'DOUBLE',
				Time: '1606474470069',
			},
		])
	})
})
