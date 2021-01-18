import { info } from './note'
import { promises as fs } from 'fs'
import * as path from 'path'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { CORE_STACK_NAME } from '../stacks/stackName'
import * as chalk from 'chalk'

export const loadContext = async ({
	sts,
}: {
	sts: STSClient
}): Promise<Record<string, string>> => {
	const { Account } = await sts.send(new GetCallerIdentityCommand({}))
	const accountWithStackFilename = `${Account}-${CORE_STACK_NAME}.context.cfg`
	const stackFilename = `${CORE_STACK_NAME}.context.cfg`
	const plainFilename = `context.cfg`
	const loadLocations = [accountWithStackFilename, stackFilename, plainFilename]

	let contextData
	do {
		try {
			const f = loadLocations.shift() as string
			contextData = await fs.readFile(path.join(process.cwd(), f), 'utf-8')
			info('Context', `Local stack config loaded from ${chalk.white(f)}`)
		} catch {
			// Pass
		}
	} while (loadLocations.length > 0 && contextData === undefined)

	if (contextData === undefined) {
		info(
			'Context',
			`Local stack context config does not exist. (Tried ${[
				accountWithStackFilename,
				stackFilename,
				plainFilename,
			]
				.map((s) => chalk.white(s))
				.join(', ')})`,
		)
		return {}
	}
	const context = contextData
		.split('\n')
		.map((s) => s.trim())
		.filter((s) => s)
		.map((s) => s.split('='))
		.reduce((context, [k, v]) => ({ ...context, [k]: v }), {})
	return context
}
