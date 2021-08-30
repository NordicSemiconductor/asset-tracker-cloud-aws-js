export const retry =
	<T>(
		tries: number,
		backoff: (numTry: number) => number = (numTry) => numTry * 1000,
	) =>
	async (fn: () => Promise<T>): Promise<T> => {
		let triesLeft = tries
		let lastError: Error
		do {
			triesLeft--
			try {
				const res = await fn()
				return res
			} catch (err) {
				if (triesLeft <= 0) throw err
				lastError = err as Error
				await new Promise((resolve) => {
					setTimeout(resolve, backoff(tries - triesLeft), [])
				})
			}
		} while (triesLeft > 0)
		throw lastError
	}
