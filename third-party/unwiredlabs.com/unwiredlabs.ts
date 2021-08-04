import { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings'

export const getApiSettings =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (): Promise<{ apiKey: string; endpoint: string }> => {
		const p = await getSettings({
			ssm,
			stackName,
			scope: 'thirdParty',
			system: 'unwiredlabs',
		})()
		const { apiKey, endpoint } = p
		if (apiKey === undefined) throw new Error('No API key configured!')
		return {
			apiKey,
			endpoint: endpoint ?? 'https://eu1.unwiredlabs.com/',
		}
	}
