import {
	consoleReporter,
	type SuiteResult,
} from '@nordicsemiconductor/bdd-markdown'

const chunks: string[] = []

process.stdin.on('data', (chunk) => chunks.push(chunk.toString()))

await new Promise((resolve) => process.stdin.on('end', resolve))

let res: SuiteResult
try {
	res = JSON.parse(chunks.join(''))
} catch (error) {
	throw new Error(`Failed to parse result JSON: ${(error as Error).message}`)
}

consoleReporter(res, console.log)

if (!res.ok) process.exit(1)
