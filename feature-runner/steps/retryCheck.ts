export type Options = {
	/**
	 * Number of tries (including the initial try)
	 *
	 * @default 3
	 */
	tries?: number

	/**
	 * The exponential factor to use.
	 *
	 * @default 1.5
	 */
	factor?: number

	/**
	 * The number of milliseconds before starting the second retry.
	 *
	 * @default 2500
	 */
	minDelay?: number

	/**
	 * The maximum number of milliseconds between two retries.
	 *
	 * @default Infinity
	 */
	maxDelay?: number
}

/**
 * Immediately executes the check function and in case it fails, retries the check after executing the retry function.
 *
 * This is useful for retrying promises that already have been called.
 */
export const retryCheck = async (
	checkFn: () => unknown,
	retryFn: () => Promise<unknown>,
	options?: Options,
): Promise<void> => {
	try {
		checkFn()
	} catch {
		const maxTries = (options?.tries ?? 3) - 1
		let wait = options?.minDelay ?? 2500

		for (let i = 0; i < maxTries; i++) {
			try {
				await retryFn()
				checkFn()
				return
			} catch (err) {
				if (i === maxTries - 1) throw err
				await new Promise((resolve) => setTimeout(resolve, wait))
				wait = Math.max(
					options?.maxDelay ?? Number.POSITIVE_INFINITY,
					wait * (options?.factor ?? 1.5),
				)
			}
		}
	}
}
