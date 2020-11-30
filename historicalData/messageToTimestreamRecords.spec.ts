import { messageToTimestreamRecords } from './messageToTimestreamRecords'

describe('messageToTimestreamRecords', () => {
	it('should convert a message to Timestream records', () => {
		const Dimensions = [
			{ Name: 'deviceId', Value: 'slipslop-particle-santalum' },
			{ Name: 'messageId', Value: '2bba2855-8858-4308-bbce-a91ca230da7a' },
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
				messageId: '2bba2855-8858-4308-bbce-a91ca230da7a',
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
