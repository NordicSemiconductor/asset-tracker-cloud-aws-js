import type { Static } from '@sinclair/typebox'
import { gpsDay } from './gpsTime.js'
import type { pgpsRequestSchema } from './types.js'

// Default values, all properties for requests are optional
export const defaultNumberOfPredictions = 42
export const defaultInterval = 240
export const defaultTimeOfDay = 0

export const cacheKey = ({
	request,
	binHours,
}: {
	request: Static<typeof pgpsRequestSchema>
	binHours: number
}): string => {
	const binMs = binHours * 60 * 60 * 1000
	const { n, day, int, time } = request
	return `${n ?? defaultNumberOfPredictions}-${int ?? defaultInterval}-${
		day ?? gpsDay()
	}-${time ?? defaultTimeOfDay}-${new Date(
		Math.floor(Date.now() / binMs) * binMs,
	)
		.toISOString()
		.slice(0, 19)
		.replace(/[:-]/g, '')}`
}
