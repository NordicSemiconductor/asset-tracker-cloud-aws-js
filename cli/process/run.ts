import { spawn } from 'child_process'
import os from 'os'

export const run = async (args: {
	command: string
	args?: string[]
	input?: string
	log?: (...message: any[]) => void
}): Promise<string> =>
	new Promise((resolve, reject) => {
		args?.log?.(`${args.command} ${args.args?.join(' ')}`)
		const p = spawn(args.command, args.args)
		const result = [] as string[]
		const errors = [] as string[]
		if (args.input !== undefined) {
			p.stdin.write(args.input)
		}
		p.on('close', (code) => {
			if (code !== 0) {
				return reject(
					new Error(
						`${args.command} ${args.args?.join(' ')} failed: ${errors.join(
							os.EOL,
						)}`,
					),
				)
			}
			return resolve(result.join(os.EOL))
		})
		p.stdout.on('data', (data) => {
			result.push(data)
		})
		p.stderr.on('data', (data) => {
			errors.push(data)
		})
	})
