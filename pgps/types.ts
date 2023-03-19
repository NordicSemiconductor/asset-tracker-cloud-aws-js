import { Type } from '@sinclair/typebox'
import { minimumGpsDay } from './gpsTime'

/**
 * @see https://api.nrfcloud.com/v1#tag/Predicted-GPS/operation/GetPredictedAssistanceData
 */
export const pgpsRequestSchema = Type.Object({
	n: Type.Optional(
		Type.Integer({ minimum: 1, title: 'number of predictions' }),
	),
	int: Type.Optional(
		Type.Integer({ minimum: 1, title: 'prediction interval in minutes' }),
	),
	day: Type.Optional(
		Type.Integer({
			minimum: minimumGpsDay(),
			maximum: 99999, // The actual minimum depends on the provider in use, do some sanity clamping here.
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
