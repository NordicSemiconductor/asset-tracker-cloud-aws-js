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
	const { nw, mcc, mnc, cell, area, types } = request
	return `${
		nw.toLocaleLowerCase().includes('nb-iot') ? 'nbiot' : 'ltem'
	}-${mcc}-${mnc}-${cell}-${area}-${types.join(',')}-${new Date(
		Math.floor(Date.now() / binMs) * binMs,
	).toISOString()}`
}
