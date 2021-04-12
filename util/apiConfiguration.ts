import {
	GetParametersByPathCommand,
	SSMClient,
	PutParameterCommand,
	DeleteParameterCommand,
} from '@aws-sdk/client-ssm'

type ApiSettingsScopes = 'cellGeoLocation' | 'codebuild'
type ApiScopes = 'unwiredlabs' | 'github' | 'nrfconnectforcloud'

export const getApiSettings = ({
	ssm,
	stackName,
	scope,
	api,
}: {
	ssm: SSMClient
	stackName: string
	scope: ApiSettingsScopes
	api: ApiScopes
}) => async (): Promise<Record<string, string>> => {
	const Path = `/${stackName}/${scope}/${api}`
	const { Parameters } = await ssm.send(
		new GetParametersByPathCommand({
			Path,
			Recursive: true,
		}),
	)

	if (Parameters === undefined) throw new Error(`API not configured: ${Path}!`)

	return Parameters.map(({ Name, ...rest }) => ({
		...rest,
		Name: Name?.replace(`${Path}/`, ''),
	})).reduce(
		(settings, { Name, Value }) => ({
			...settings,
			[Name ?? '']: Value ?? '',
		}),
		{} as Record<string, string>,
	)
}

export const putApiSetting = ({
	ssm,
	stackName,
	scope,
	api,
}: {
	ssm: SSMClient
	stackName: string
	scope: ApiSettingsScopes
	api: ApiScopes
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
	const Name = `/${stackName}/${scope}/${api}/${property}`
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
