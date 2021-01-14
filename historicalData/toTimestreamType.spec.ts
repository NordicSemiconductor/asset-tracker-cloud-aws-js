import { toTimestreamType } from './toTimestreamType.js'
import { TestRunner } from '../test-runner'
import hamjest from 'hamjest'
const { assertThat, is, equalTo } = hamjest

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('toTimestreamType()', ({ test: it }) => {
		const tests = [
			[true, 'BOOLEAN'],
			[1.1, 'DOUBLE'],
			[1, 'DOUBLE'],
			['foo', 'VARCHAR'],
			['12345678901234567890', 'VARCHAR'],
		]
		tests.forEach(([v, expected]) => {
			it(`should determine ${v} as ${expected}`, () => {
				assertThat(toTimestreamType(v), is(equalTo(expected)))
			})
		})
	})
}
