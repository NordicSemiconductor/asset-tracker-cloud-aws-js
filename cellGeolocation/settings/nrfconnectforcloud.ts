import { SSMClient } from '@aws-sdk/client-ssm'
import { getApiSettings } from '../../util/apiConfiguration'

export const getNrfConnectForCloudApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}) => async (): Promise<{
	apiKey: string
	endpoint: string
	apiDevice: string
}> => {
	const p = await getApiSettings({
		ssm,
		stackName,
		scope: 'cellGeoLocation',
		api: 'nrfconnectforcloud',
	})()
	const { apiKey, endpoint, apiDevice } = p
	if (apiKey === undefined) throw new Error('No API key configured!')
	if (apiDevice === undefined) throw new Error('No API device configured!')
	return {
		apiKey,
		apiDevice,
		endpoint: endpoint ?? 'https://api.nrfcloud.com/',
	}
}
