import { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings'

type StackContexts = {
	unwiredlabs: '0' | '1'
	nrfcloudAGPS: '0' | '1'
	nrfcloudPGPS: '0' | '1'
	nrfcloudGroundFix: '0' | '1'
	cd: '0' | '1'
	webapp: '0' | '1'
	'firmware-ci': '0' | '1'
}

const defaults: StackContexts = {
	unwiredlabs: '0',
	nrfcloudAGPS: '0',
	nrfcloudPGPS: '0',
	nrfcloudGroundFix: '0',
	cd: '0',
	webapp: '1',
	'firmware-ci': '0',
}

export const getStackContexts =
	({
		ssm,
		stackName,
	}: {
		ssm: SSMClient
		stackName: string
	}): (() => Promise<StackContexts>) =>
	async () =>
		getSettings<Partial<StackContexts>>({
			ssm,
			system: 'stack',
			scope: 'context',
			stackName,
		})()
			.then((cfg) => ({ ...defaults, ...cfg }))
			.catch(() => defaults)
