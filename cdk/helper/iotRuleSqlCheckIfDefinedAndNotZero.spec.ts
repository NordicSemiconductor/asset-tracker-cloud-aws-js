import { iotRuleSqlCheckIfDefinedAndNotZero } from './iotRuleSqlCheckIfDefinedAndNotZero.js'

import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('iotRuleSqlCheckIfDefinedAndNotZero', () => {
	void it('should check for undefined for the given values', () =>
		assert.equal(
			iotRuleSqlCheckIfDefinedAndNotZero(['foo', 'bar']),
			'(isUndefined(foo) = true OR foo > 0) AND (isUndefined(bar) = true OR bar > 0)',
		))
})
