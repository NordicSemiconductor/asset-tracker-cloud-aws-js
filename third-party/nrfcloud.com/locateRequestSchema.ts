import { Type } from '@sinclair/typebox'

const cells = Type.Array(
	Type.Object(
		{
			eci: Type.Integer({ minimum: 1 }),
			mcc: Type.Integer({ minimum: 100, maximum: 999 }),
			mnc: Type.Integer({ minimum: 1, maximum: 999 }),
			tac: Type.Integer({ minimum: 1 }),
		},
		{ additionalProperties: false },
	),
	{ minItems: 1 },
)

export const locateRequestSchema = Type.Union([
	Type.Object({
		lte: cells,
	}),
	Type.Object({
		nbiot: cells,
	}),
])
