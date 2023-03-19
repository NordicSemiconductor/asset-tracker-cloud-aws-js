import {
	DeleteParameterCommand,
	GetParametersByPathCommand,
	Parameter,
	PutParameterCommand,
	SSMClient,
} from '@aws-sdk/client-ssm'
import { paginate } from './paginate.js'

type Scopes = 'context' | 'config' | 'thirdParty' | 'codebuild'
type Systems = 'stack' | 'github' | 'nrfcloud' | 'sentry'

export const settingsPath = ({
	stackName,
	scope,
	system,
}: {
	stackName: string
	scope: Scopes
	system: Systems
}): string => `/${stackName}/${scope}/${system}`

const settingsName = ({
	stackName,
	scope,
	system,
	property,
}: {
	stackName: string
	scope: Scopes
	system: Systems
	property: string
}): string => `${settingsPath({ stackName, scope, system })}/${property}`

export const getSettings =
	<Settings extends Record<string, string>>({
		ssm,
		stackName,
		scope,
		system,
	}: {
		ssm: SSMClient
		stackName: string
		scope: Scopes
		system: Systems
	}) =>
	async (): Promise<Settings> => {
		const Path = settingsPath({ stackName, scope, system })
		const Parameters: Parameter[] = []
		await paginate({
			paginator: async (NextToken?: string) =>
				ssm
					.send(
						new GetParametersByPathCommand({
							Path,
							Recursive: true,
							NextToken,
						}),
					)

					.then(async ({ Parameters: p, NextToken }) => {
						if (p !== undefined) Parameters.push(...p)
						return NextToken
					}),
		})

		if (Parameters.length === 0)
			throw new Error(`System not configured: ${Path}!`)

		return Parameters.map(({ Name, ...rest }) => ({
			...rest,
			Name: Name?.replace(`${Path}/`, ''),
		})).reduce(
			(settings, { Name, Value }) => ({
				...settings,
				[Name ?? '']: Value ?? '',
			}),
			{} as Settings,
		)
	}

export const putSettings =
	({
		ssm,
		stackName,
		scope,
		system,
	}: {
		ssm: SSMClient
		stackName: string
		scope: Scopes
		system: Systems
	}) =>
	async ({
		property,
		value,
		deleteBeforeUpdate,
	}: {
		property: string
		value: string
		/**
		 * Useful when depending on the parameter having version 1, e.g. for use in CloudFormation
		 */
		deleteBeforeUpdate?: boolean
	}): Promise<{ name: string }> => {
		const Name = settingsName({ stackName, scope, system, property })
		if (deleteBeforeUpdate ?? false) {
			try {
				await ssm.send(
					new DeleteParameterCommand({
						Name,
					}),
				)
			} catch {
				// pass
			}
		}
		await ssm.send(
			new PutParameterCommand({
				Name,
				Value: value,
				Type: 'String',
				Overwrite: !(deleteBeforeUpdate ?? false),
			}),
		)
		return { name: Name }
	}

export const deleteSettings =
	({
		ssm,
		stackName,
		scope,
		system,
	}: {
		ssm: SSMClient
		stackName: string
		scope: Scopes
		system: Systems
	}) =>
	async ({ property }: { property: string }): Promise<{ name: string }> => {
		const Name = settingsName({ stackName, scope, system, property })
		await ssm.send(
			new DeleteParameterCommand({
				Name,
			}),
		)
		return { name: Name }
	}
