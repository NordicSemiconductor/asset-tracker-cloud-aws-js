import { Type } from '@sinclair/typebox'
import { gpsDay } from './gpsTime'

export const pgpsRequestSchema = Type.Object({
	n: Type.Optional(
		Type.Integer({ minimum: 1, title: 'number of predictions' }),
	),
	int: Type.Optional(
		Type.Integer({ minimum: 1, title: 'prediction interval in minutes' }),
	),
	day: Type.Optional(
		Type.Integer({
			minimum: gpsDay(), // Devices should not request data from the past
			title: 'start day of the prediction set as GPS Day',
		}),
	),
	time: Type.Optional(
		Type.Integer({
			minimum: 0,
			maximum: 86399,
			title: 'start time of the prediction set as seconds in day',
		}),
	),
})
