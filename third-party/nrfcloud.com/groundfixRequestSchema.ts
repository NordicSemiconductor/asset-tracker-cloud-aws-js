import { Type } from '@sinclair/typebox'

const cells = Type.Array(
	Type.Object(
		{
			eci: Type.Integer({ minimum: 1 }),
			mcc: Type.Integer({ minimum: 100, maximum: 999 }),
			mnc: Type.Integer({ minimum: 1, maximum: 99 }),
			tac: Type.Integer({ minimum: 1 }),
		},
		{ additionalProperties: false },
	),
	{ minItems: 1 },
)

const accessPoints = Type.Object({
	accessPoints: Type.Array(
		Type.Object(
			{
				macAddress: Type.String(),
				age: Type.Optional(Type.Integer()),
				frequency: Type.Optional(Type.Number()),
				channel: Type.Optional(Type.Integer()),
				signalStrength: Type.Optional(
					Type.Integer({ minimum: -128, maximum: 0 }),
				),
				signalToNoiseRadio: Type.Optional(Type.Integer()),
				ssid: Type.Optional(Type.String()),
			},
			{ additionalProperties: false },
		),
		{
			minItems: 2,
		},
	),
})

export const groundfixRequestSchema = Type.Union([
	Type.Object({
		lte: cells,
	}),
	Type.Object({
		wifi: accessPoints,
	}),
])
