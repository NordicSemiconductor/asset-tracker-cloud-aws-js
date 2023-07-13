import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchStep } from './util.js'
import type { UserCredentials } from './cognito'
import type { AnyRecord } from 'dns'

const steps: StepRunner<
	World & { cognito?: UserCredentials; awsSDK?: { res: AnyRecord } }
>[] = [
	matchStep(
		new RegExp(
			'^I execute `(?<methodName>[^`]+)` of `@aws-sdk/client-(?<clientName>[^`]+)`(?<withArgs> with)$',
		),
		Type.Object({
			clientName: Type.String(),
			methodName: Type.String(),
			withArgs: Type.Optional(Type.String()),
		}),
		async (
			{ clientName, methodName, withArgs },
			{
				context,
				log: {
					step: { progress },
				},
				step,
			},
		) => {
			const code = withArgs === undefined ? undefined : codeBlockOrThrow(step)

			let args: Record<string, any> | undefined = undefined

			if (code !== undefined) {
				if (code.language !== 'json') throw new Error(`Arguments must be JSON.`)

				try {
					args = JSON.parse(code.code)
				} catch {
					throw new Error(`Failed to parse arguments code block!`)
				}
			}

			const clientPackageName = `@aws-sdk/client-${clientName}`
			progress(clientPackageName)
			const clientLibrary = await import(clientPackageName)

			const clientClassName = toClientClassName(clientName)

			progress(clientClassName)
			const client = new clientLibrary[clientClassName](
				context.cognito === undefined
					? {}
					: {
							credentials: {
								secretAccessKey: context.cognito.SecretKey,
								identityId: context.cognito.IdentityId,
								accessKeyId: context.cognito.AccessKeyId,
								sessionToken: context.cognito.SessionToken,
							},
					  },
			)

			const commandName = `${ucfirst(methodName)}Command`

			progress(commandName)

			const command = clientLibrary[commandName]

			try {
				progress(`new ${commandName}(${JSON.stringify(args)})`)
				const commandInstance = new command(args)

				const res = await client.send(commandInstance)

				context.awsSDK = { res }

				progress(JSON.stringify(res))

				return { result: res }
			} catch (error) {
				throw new Error(
					`Failed to create ${commandName} of ${clientPackageName}: ${
						(error as Error).message
					}. Check the documentation at https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/${clientName}/command/${commandName}/`,
				)
			}
		},
	),
]
export default steps

const ucfirst = (s: string): string =>
	`${s.slice(0, 1).toUpperCase()}${s.slice(1)}`

const toClientClassName = (clientName: string) => {
	const parts = clientName.split('-')
	if (parts[0] === 'iot') parts[0] = 'IoT'
	return `${parts.map(ucfirst).join('')}Client`
}
