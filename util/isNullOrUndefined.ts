export const isNullOrUndefined = (arg?: unknown): boolean =>
	arg === undefined || arg === null

export const isNotNullOrUndefined = (arg?: unknown): boolean =>
	!isNullOrUndefined(arg)
