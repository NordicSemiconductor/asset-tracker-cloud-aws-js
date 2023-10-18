import { Type } from '@sinclair/typebox'

export enum AGNSSType {
	'GPS UTC' = 1,
	'GPS Ephemerides' = 2,
	'GPS Almanac' = 3,
	'Klobuchar Ionospheric Correction' = 4,
	'Nequick Ionospheric Correction' = 5,
	'GPS Time of Week' = 6,
	'GPS System Clock' = 7,
	'Location (lat/lon of cell)' = 8,
	'GPS Integrity' = 9,
	'QZSS Almanac' = 11,
	'QZSS Ephemerides' = 12,
	'QZSS Integrity' = 13,
}

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

/**
 * @see https://api.nrfcloud.com/v1#tag/GNSS/operation/GetAssistanceData
 */
export const agnssRequestSchema = Type.Object({
	mcc: Type.Integer({ minimum: 100, maximum: 999 }),
	mnc: Type.Integer({ minimum: 0, maximum: 999 }),
	cell: PositiveInteger,
	area: PositiveInteger,
	phycell: Type.Optional(PositiveInteger),
	types: Type.Array(Type.Enum(AGNSSType), { minItems: 1 }),
})
