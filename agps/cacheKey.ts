import { Static } from '@sinclair/typebox'
import { agpsRequestSchema } from './types'

export const cacheKey = ({
	request,
	binHours,
}: {
	request: Static<typeof agpsRequestSchema>
	binHours: number
}): string => {
	const binMs = binHours * 60 * 60 * 1000
	const { mcc, mnc, cell, area, types } = request
	return `${mcc}-${mnc}-${cell}-${area}-${types.join('_')}-${new Date(
		Math.floor(Date.now() / binMs) * binMs,
	)
		.toISOString()
		.substring(0, 19)
		.replace(/[:-]/g, '')}`
}
