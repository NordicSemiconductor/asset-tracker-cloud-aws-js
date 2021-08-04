import { Type } from '@sinclair/typebox'

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })

export const pgpsRequestSchema = Type.Object({
	n: Type.Optional(PositiveInteger),
	int: Type.Optional(PositiveInteger),
	day: Type.Optional(PositiveInteger),
	time: Type.Optional(PositiveInteger),
})
