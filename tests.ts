import { create } from './test-runner.js'
import glob from 'glob'

const main = async (testFiles: string[]) => {
	const runner = create()

	await Promise.all(
		testFiles.map(async (s) => {
			const { tests } = await import(s)
			await tests(runner)
		}),
	)

	const allPass = await runner.done()
	await runner.print()
	if (allPass !== true) process.exit(1)
}

const testFiles = glob
	.sync(process.argv[process.argv.length - 1])
	.filter((s) => !s.includes('node_modules'))

void main(testFiles)
