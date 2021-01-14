import chalk from 'chalk'

export type TestFN = (() => Promise<void>) | (() => void)
export type ScopedFn = (scope: Scope) => void

export type Scope = {
	test: (label: string, testFn: TestFN) => void
}

export type TestRunner = {
	describe: (label: string, fn: ScopedFn) => void
	done: () => Promise<boolean>
	print: () => Promise<void>
}

export const create: () => TestRunner = () => {
	const scopes: Record<string, Promise<{ label: string; error?: Error }>[]> = {}
	return {
		describe: (scope: string, fn: ScopedFn) => {
			if (scopes[scope] === undefined) {
				scopes[scope] = []
			}
			fn({
				test: async (label: string, testFn: TestFN) => {
					scopes[scope].push(
						new Promise((resolve) => {
							try {
								const res = testFn()
								if (res !== undefined) {
									res
										.then(() => {
											resolve({ label })
										})
										.catch((error) => {
											resolve({ label, error })
										})
								} else {
									resolve({ label })
								}
							} catch (error) {
								resolve({ label, error })
							}
						}),
					)
				},
			})
		},
		done: async () =>
			(await Promise.all(Object.values(scopes).flat())).reduce(
				(allPass, { error }) =>
					(allPass === true && error === undefined) || false,
				true as boolean,
			),
		print: async () => {
			await Promise.all(
				Object.entries(scopes).map(async ([scope, tests]) => {
					const results = await Promise.all(tests)
					console.log('', chalk.grey(scope))
					results.forEach(({ label, error }) => {
						if (error === undefined) {
							console.log('', chalk.green.bold(' ✓'), chalk.white(label))
						} else {
							console.error('', chalk.red.bold('❌'), chalk.white(label))
							console.error(error)
						}
					})
				}),
			)
		},
	}
}
