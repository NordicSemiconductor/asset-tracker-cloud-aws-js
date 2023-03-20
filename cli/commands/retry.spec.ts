import { retry } from './retry.js'

describe('retry()', () => {
	it('should run a passed function and return the resolved promise', async () => {
		expect(await retry(3, () => 1)(async () => Promise.resolve(42))).toEqual(42)
	})
	it('should retry a passed function if it fails', async () => {
		const err = new Error('Foo')
		const f = jest.fn(async () => Promise.reject(err))
		try {
			expect(await retry(3, () => 1)(f))
		} catch (err) {
			expect(err).toBe(err)
		}
		expect(f).toHaveBeenCalledTimes(3)
	})
	it('should return success value after a failed try', async () => {
		const err = new Error('Foo')
		const f = jest.fn()
		f.mockImplementationOnce(async () => Promise.reject(err))
		f.mockImplementationOnce(async () => Promise.resolve(42))
		expect(await retry(3, () => 1)(f)).toEqual(42)
		expect(f).toHaveBeenCalledTimes(2)
	})
})
