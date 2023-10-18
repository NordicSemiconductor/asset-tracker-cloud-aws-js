import type { Static } from '@sinclair/typebox'
import type { agnssRequestSchema } from './types.js'

export const cacheKey = ({
	request,
	binHours,
}: {
	request: Static<typeof agnssRequestSchema>
	binHours: number
}): string => {
	const binMs = binHours * 60 * 60 * 1000
	const { mcc, mnc, cell, area, types } = request
	return `${mcc}-${mnc}-${cell}-${area}-${types.join('_')}-${new Date(
		Math.floor(Date.now() / binMs) * binMs,
	)
		.toISOString()
		.slice(0, 19)
		.replace(/[:-]/g, '')}`
}
