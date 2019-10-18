import { SSM } from 'aws-sdk'

export const getApiSettings = ({ ssm }: { ssm: SSM }) => async ({ api }: { api: 'unwiredlabs' }) => {
    const Path = `/bifravst/cellGeoLocation/${api}`
    const { Parameters } = await ssm.getParametersByPath({
        Path,
        Recursive: true
    }).promise()

    const apiKey = Parameters?.find(({ Name }) => Name?.replace(`${Path}/`, '') === 'apiKey') ?.Value
    const endpoint = Parameters?.find(({ Name }) => Name?.replace(`${Path}/`, '') === 'endpoint') ?.Value ?? 'https://eu1.unwiredlabs.com/'

    return {
        apiKey,
        endpoint
    }
}