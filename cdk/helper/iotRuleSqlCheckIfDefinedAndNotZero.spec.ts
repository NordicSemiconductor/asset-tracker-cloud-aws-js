import { iotRuleSqlCheckIfDefinedAndNotZero } from './iotRuleSqlCheckIfDefinedAndNotZero.js'

describe('iotRuleSqlCheckIfDefinedAndNotZero', () => {
	it('should check for undefined for the given values', () =>
		expect(iotRuleSqlCheckIfDefinedAndNotZero(['foo', 'bar'])).toEqual(
			'(isUndefined(foo) = true OR foo > 0) AND (isUndefined(bar) = true OR bar > 0)',
		))
})
