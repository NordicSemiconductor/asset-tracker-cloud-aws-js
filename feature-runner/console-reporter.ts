import {
	consoleReporter,
	type SuiteResult,
} from '@nordicsemiconductor/bdd-markdown'
import { readFileSync } from 'node:fs'

const data = readFileSync(0 as any, 'utf-8')

let res: SuiteResult
try {
	res = JSON.parse(data)
} catch (error) {
	throw new Error(`Failed to parse result JSON: ${(error as Error).message}`)
}

consoleReporter(res, console.log)

if (!res.ok) process.exit(1)
