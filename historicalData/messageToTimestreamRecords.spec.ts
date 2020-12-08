import { messageToTimestreamRecords } from './messageToTimestreamRecords'

describe('messageToTimestreamRecords', () => {
	it('should convert a message to Timestream records', () => {
		const Dimensions = [
			{
				Name: 'measureGroup',
				Value: expect.stringMatching(
					/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
				),
			},
		]
		expect(
			messageToTimestreamRecords({
				message: {
					btn: {
						v: 0,
						ts: 1606474470069,
					},
				},
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
