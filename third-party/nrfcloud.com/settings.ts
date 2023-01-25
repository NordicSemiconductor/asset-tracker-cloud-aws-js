import { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings'

type nRFCloudLocationService =
	| 'agpsLocation'
	| 'pgpsLocation'
	| 'cellLocation'
	| 'groundFix'

export const serviceKeyProperty = (service: nRFCloudLocationService): string =>
	`${service}ServiceKey`

const getApiSettings =
	({
		ssm,
		stackName,
		service,
	}: {
		ssm: SSMClient
		stackName: string
		service: nRFCloudLocationService
	}) =>
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
		const { endpoint, teamId } = p
		if (teamId === undefined)
			throw new Error(`No nRF Cloud team ID configured!`)
		if (p[serviceKeyProperty(service)] === undefined)
			throw new Error(`No nRF Cloud service key configured for ${service}!`)
		return {
			serviceKey: p[serviceKeyProperty(service)],
			endpoint: endpoint ?? 'https://api.nrfcloud.com/',
			teamId,
		}
	}

export const getAGPSLocationApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): ReturnType<typeof getApiSettings> =>
	getApiSettings({ ssm, stackName, service: 'agpsLocation' })

export const getPGPSLocationApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): ReturnType<typeof getApiSettings> =>
	getApiSettings({ ssm, stackName, service: 'pgpsLocation' })

export const getCellLocationApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): ReturnType<typeof getApiSettings> =>
	getApiSettings({ ssm, stackName, service: 'cellLocation' })

export const getGroundFixApiSettings = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): ReturnType<typeof getApiSettings> =>
	getApiSettings({ ssm, stackName, service: 'groundFix' })