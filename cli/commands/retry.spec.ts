import { retry } from './retry.js'
import hamjest from 'hamjest'
const { assertThat, is, equalTo } = hamjest
import { TestRunner } from '../../test-runner.js'

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('retry()', ({ test: it }) => {
		it('should run a passed function and return the resolved promise', async () => {
			assertThat(
				await retry(3, () => 1)(async () => Promise.resolve(42)),
				is(equalTo(42)),
			)
		})

		it('should retry a passed function if it fails', async () => {
			const expectedError = new Error('Foo')
			let numCalls = 0
			const f = async () => {
				numCalls++
				return Promise.reject(expectedError)
			}
			try {
				await retry(3, () => 1)(f)
			} catch (err) {
				assertThat(err, is(equalTo(expectedError)))
			}
			assertThat(numCalls, is(equalTo(3)))
		})

		it('should return success value after a failed try', async () => {
			const err = new Error('Foo')
			let numCalls = 0
			const f = async () => {
				if (numCalls++ === 1) return Promise.resolve(42)
				return Promise.reject(err)
			}
			assertThat(await retry(3, () => 1)(f), is(equalTo(42)))
			assertThat(numCalls, is(equalTo(2)))
		})
	})
}
