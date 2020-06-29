const STACK_ID = process.env.STACK_ID ?? 'bifravst'

export const stackId = (
	purpose?: 'webapps' | 'sourcecode' | 'continuous-deployment',
): string => (purpose === undefined ? STACK_ID : `${STACK_ID}-${purpose}`)
