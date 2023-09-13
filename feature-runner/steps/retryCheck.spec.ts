import { retryCheck } from './retryCheck.js'

describe('retryCheck()', () => {
	it('should execute the check function once if it succeeds', async () => {
		const checkFn = jest.fn(() => true).mockName('checkFn')
		const retryFn = jest.fn(async () => Promise.resolve()).mockName('retryFn')
		await retryCheck(checkFn, retryFn)
		expect(checkFn).toHaveBeenCalledTimes(1)
		expect(retryFn).toHaveBeenCalledTimes(0)
	})
	it('should run the retry function if the check function fails', async () => {
		const checkFn = jest.fn().mockName('checkFn')
		checkFn.mockImplementationOnce(() => {
			throw new Error()
		})
		checkFn.mockReturnValueOnce(true)
		const retryFn = jest.fn(async () => Promise.resolve()).mockName('retryFn')
		await retryCheck(checkFn, retryFn)
		expect(checkFn).toHaveBeenCalledTimes(2)
		expect(retryFn).toHaveBeenCalledTimes(1)
	})
	it('should reject with error from check function if number of retries is exceeded', async () => {
		const err = new Error()
		const checkFn = jest
			.fn(() => {
				throw err
			})
			.mockName('checkFn')
		const retryFn = jest.fn(async () => Promise.resolve()).mockName('retryFn')
		try {
			await retryCheck(checkFn, retryFn, {
				tries: 3,
				minDelay: 0,
				maxDelay: 0,
			})
		} catch (error) {
			expect(error).toEqual(err)
		}
		expect(checkFn).toHaveBeenCalledTimes(3)
		expect(retryFn).toHaveBeenCalledTimes(2)
	})
})
