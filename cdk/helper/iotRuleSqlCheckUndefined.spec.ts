import { iotRuleSqlCheckUndefined } from './iotRuleSqlCheckUndefined.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('iotRuleSqlCheckUndefined', () => {
	void it('should check for undefined for the given values', () =>
		assert.equal(
			iotRuleSqlCheckUndefined(['foo', 'bar']),
			'isUndefined(foo) = false AND isUndefined(bar) = false',
		))
})
