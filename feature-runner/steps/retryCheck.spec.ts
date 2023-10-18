import { retryCheck } from './retryCheck.js'
import { describe, it, mock } from 'node:test'
import assert from 'node:assert'

void describe('retryCheck()', () => {
	void it('should execute the check function once if it succeeds', async () => {
		const checkFn = mock.fn(() => true)
		const retryFn = mock.fn(async () => Promise.resolve())
		await retryCheck(checkFn, retryFn)
		assert.equal(checkFn.mock.callCount(), 1)
		assert.equal(retryFn.mock.callCount(), 0)
	})
	void it('should run the retry function if the check function fails', async () => {
		const checkFn = mock.fn()
		checkFn.mock.mockImplementationOnce(() => {
			throw new Error()
		}, 0)
		checkFn.mock.mockImplementationOnce(() => true, 1)
		const retryFn = mock.fn(async () => Promise.resolve())
		await retryCheck(checkFn, retryFn)
		assert.equal(checkFn.mock.callCount(), 2)
		assert.equal(retryFn.mock.callCount(), 1)
	})
	void it('should reject with error from check function if number of retries is exceeded', async () => {
		const err = new Error()
		const checkFn = mock.fn(() => {
			throw err
		})

		const retryFn = mock.fn(async () => Promise.resolve())
		try {
			await retryCheck(checkFn, retryFn, {
				tries: 3,
				minDelay: 0,
				maxDelay: 0,
			})
		} catch (error) {
			assert.equal(error, err)
		}
		assert.equal(checkFn.mock.callCount(), 3)
		assert.equal(retryFn.mock.callCount(), 2)
	})
})
