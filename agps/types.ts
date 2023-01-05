import { Type } from '@sinclair/typebox'

export enum AGPSType {
	'UTC parameters' = 1,
	'Ephemerides' = 2,
	'Almanac' = 3,
	'Klobuchar ionospheric correction parameters' = 4,
	'GPS time of week' = 6,
	'GPS system clock and time of week' = 7,
	'Approximate location' = 8,
	'Satellite integrity data' = 9,
}

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

export const agpsRequestSchema = Type.Object({
	mcc: Type.Integer({ minimum: 100, maximum: 999 }),
	mnc: Type.Integer({ minimum: 0, maximum: 999 }),
	cell: PositiveInteger,
	area: PositiveInteger,
	phycell: Type.Optional(PositiveInteger),
	types: Type.Array(Type.Enum(AGPSType), { minItems: 1 }),
})
