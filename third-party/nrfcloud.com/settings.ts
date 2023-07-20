import type { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings.js'

const getApiSettings =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (): Promise<{
		endpoint: string
		serviceKey: string
		teamId: string
	}> => {
		const p = await getSettings({
			ssm,
			stackName,
			scope: 'thirdParty',
			system: 'nrfcloud',
		})()
		const { endpoint, teamId, serviceKey } = p
		if (teamId === undefined)
			throw new Error(`No nRF Cloud team ID configured!`)
		if (serviceKey === undefined)
			throw new Error(`No nRF Cloud service key configured!`)
		return {
			serviceKey,
			endpoint: endpoint ?? 'https://api.nrfcloud.com/',
			teamId,
		}
	}

export const getLocationServicesApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): ReturnType<typeof getApiSettings> => getApiSettings({ ssm, stackName })
