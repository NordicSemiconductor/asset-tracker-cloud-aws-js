import { retry } from './retry.js'
import { describe, it, mock } from 'node:test'
import assert from 'node:assert'

void describe('retry()', () => {
	void it('should run a passed function and return the resolved promise', async () => {
		assert.equal(await retry(3, () => 1)(async () => Promise.resolve(42)), 42)
	})
	void it('should retry a passed function if it fails', async () => {
		const expectedError = new Error('Foo')
		const f = mock.fn(async () => Promise.reject(expectedError))
		try {
			await retry(3, () => 1)(f)
		} catch (err) {
			assert.equal(err, err)
		}
		assert.equal(f.mock.callCount(), 3)
	})
	void it('should return success value after a failed try', async () => {
		const err = new Error('Foo')
		const f = mock.fn()
		f.mock.mockImplementationOnce(async () => Promise.reject(err), 0)
		f.mock.mockImplementationOnce(async () => Promise.resolve(42), 1)
		assert.equal(await retry(3, () => 1)(f as any), 42)
		assert.equal(f.mock.callCount(), 2)
	})
})
