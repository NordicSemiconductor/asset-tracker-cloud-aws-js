import { SSMClient } from '@aws-sdk/client-ssm'
import { getSettings } from '../../util/settings.js'

type StackContexts = {
	unwiredlabs: '0' | '1'
	nrfconnectforcloud: '0' | '1'
	cd: '0' | '1'
	webapp: '0' | '1'
	'firmware-ci': '0' | '1'
}

const defaults: StackContexts = {
	unwiredlabs: '0',
	nrfconnectforcloud: '0',
	cd: '0',
	webapp: '0',
	'firmware-ci': '0',
}

export const getStackContexts = ({
	ssm,
	stackName,
}: {
	ssm: SSMClient
	stackName: string
}): (() => Promise<StackContexts>) => async () =>
	getSettings<Partial<StackContexts>>({
		ssm,
		system: 'stack',
		scope: 'context',
		stackName,
	})()
		.then((cfg) => ({ ...defaults, ...cfg }))
		.catch(() => defaults)
