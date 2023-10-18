import { messageToTimestreamRecords } from './messageToTimestreamRecords.js'
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

void describe('messageToTimestreamRecords', () => {
	void it('should convert a message to Timestream records', () => {
		check(
			messageToTimestreamRecords({
				message: {
					btn: {
						v: 0,
						ts: 1606474470069,
					},
				},
				deviceId: 'slipslop-particle-santalum',
			}),
		).is(
			withLength(1).and(
				arrayContaining({
					Dimensions,
					MeasureName: 'btn',
					MeasureValue: '0',
					MeasureValueType: 'DOUBLE',
					Time: '1606474470069',
					TimeUnit: 'MILLISECONDS',
				}),
			),
		)
	})
	void it('should convert a impact message to Timestream records', () => {
		check(
			messageToTimestreamRecords({
				message: {
					impact: {
						v: 200,
						ts: 1606474470069,
					},
				},
				deviceId: 'slipslop-particle-santalum',
			}),
		).is(
			withLength(1).and(
				arrayContaining({
					Dimensions,
					MeasureName: 'impact',
					MeasureValue: '200',
					MeasureValueType: 'DOUBLE',
					Time: '1606474470069',
					TimeUnit: 'MILLISECONDS',
				}),
			),
		)
	})
})
