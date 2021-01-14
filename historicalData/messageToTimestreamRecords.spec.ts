import { messageToTimestreamRecords } from './messageToTimestreamRecords.js'
import { TestRunner } from '../test-runner'
import hamjest from 'hamjest'
const { assertThat, hasItem, hasProperties, hasItems, matchesPattern } = hamjest

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('messageToTimestreamRecords()', ({ test: it }) => {
		it('should convert a message to Timestream records', () => {
			const result = messageToTimestreamRecords({
				message: {
					btn: {
						v: 0,
						ts: 1606474470069,
					},
				},
				deviceId: 'slipslop-particle-santalum',
			})

			assertThat(
				result,
				hasItem(
					hasProperties({
						MeasureName: 'btn',
						MeasureValue: '0',
						MeasureValueType: 'DOUBLE',
						Time: '1606474470069',
						Dimensions: hasItems(
							hasProperties({
								Name: 'measureGroup',
								Value: matchesPattern(
									/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i,
								),
							}),
						),
					}),
				),
			)
		})
	})
}
