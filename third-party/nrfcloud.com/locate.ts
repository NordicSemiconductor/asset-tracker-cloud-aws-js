import { Type } from '@sinclair/typebox'

export const locateResultSchema = Type.Object({
	location: Type.Object({
		lat: Type.Number({ minimum: -90, maximum: 90 }),
		lng: Type.Number({ minimum: -180, maximum: 180 }),
	}),
	accuracy: Type.Number({ minimum: 0 }),
})
