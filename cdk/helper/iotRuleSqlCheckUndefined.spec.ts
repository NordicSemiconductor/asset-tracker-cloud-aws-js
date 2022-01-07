import { iotRuleSqlCheckUndefined } from './iotRuleSqlCheckUndefined.js'

describe('iotRuleSqlCheckUndefined', () => {
	it('should check for undefined for the given values', () =>
		expect(iotRuleSqlCheckUndefined(['foo', 'bar'])).toEqual(
			'isUndefined(foo) = false AND isUndefined(bar) = false',
		))
})
