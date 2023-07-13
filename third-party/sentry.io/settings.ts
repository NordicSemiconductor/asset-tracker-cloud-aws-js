import type { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings.js'

export const getSentrySettings =
	({ ssm, stackName }: { ssm: SSMClient; stackName: string }) =>
	async (): Promise<{
		sentryDsn?: string
	}> => {
		try {
			const p = await getSettings({
				ssm,
				stackName,
				scope: 'thirdParty',
				system: 'sentry',
			})()
			return {
				sentryDsn: p.sentryDsn,
			}
		} catch (err) {
			return {}
		}
	}
