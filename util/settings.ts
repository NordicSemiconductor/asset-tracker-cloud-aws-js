import {
	GetParametersByPathCommand,
	SSMClient,
	PutParameterCommand,
	DeleteParameterCommand,
} from '@aws-sdk/client-ssm'

type Scopes = 'context' | 'cellGeoLocation' | 'codebuild'
type Systems = 'stack' | 'unwiredlabs' | 'github' | 'nrfconnectforcloud'

export const getSettings = <Settings extends Record<string, string>>({
	ssm,
	stackName,
	scope,
	system,
}: {
	ssm: SSMClient
	stackName: string
	scope: Scopes
	system: Systems
}) => async (): Promise<Settings> => {
	const Path = `/${stackName}/${scope}/${system}`
	const { Parameters } = await ssm.send(
		new GetParametersByPathCommand({
			Path,
			Recursive: true,
		}),
	)

	if (Parameters === undefined)
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

export const putSettings = ({
	ssm,
	stackName,
	scope,
	system,
}: {
	ssm: SSMClient
	stackName: string
	scope: Scopes
	system: Systems
}) => async ({
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
	const Name = `/${stackName}/${scope}/${system}/${property}`
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
