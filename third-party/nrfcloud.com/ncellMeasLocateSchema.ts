import { Type } from '@sinclair/typebox'

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })
const RSRP = Type.Integer({ minimum: -199, maximum: 0, title: 'RSRP' })
const RSRQ = Type.Integer({ minimum: -99, maximum: 0, title: 'RSRQ' })
const TimingAdvance = Type.Integer({
	minimum: 0,
	maximum: 20512,
	title: 'Timing advance',
})

export const cells = Type.Array(
	Type.Object(
		{
			mcc: Type.Integer({ minimum: 100, maximum: 999 }),
			mnc: Type.Integer({ minimum: 0, maximum: 999 }),
			eci: PositiveInteger,
			tac: PositiveInteger,
			earfcn: PositiveInteger,
			adv: TimingAdvance,
			rsrp: RSRP,
			rsrq: RSRQ,
			nmr: Type.Optional(
				Type.Array(
					Type.Object(
						{
							pci: PositiveInteger,
							earfcn: PositiveInteger,
							rsrp: RSRP,
							rsrq: RSRQ,
						},
						{ additionalProperties: false },
					),
					{ minItems: 1 },
				),
			),
		},
		{ additionalProperties: false },
	),
	{ minItems: 1 },
)

export const ncellMeasLocateRequestSchema = Type.Union([
	Type.Object({
		lte: cells,
	}),
	Type.Object({
		nbiot: cells,
	}),
])

export const ncellMeasLocateInputSchema = Type.Object({
	nw: Type.String({ minLength: 1 }),
	report: Type.Object({
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 999 }),
		cell: PositiveInteger,
		area: PositiveInteger,
		earfcn: PositiveInteger,
		adv: TimingAdvance,
		rsrp: RSRP,
		rsrq: RSRQ,
		nmr: Type.Optional(
			Type.Array(
				Type.Object(
					{
						cell: PositiveInteger,
						earfcn: PositiveInteger,
						rsrp: RSRP,
						rsrq: RSRQ,
					},
					{ additionalProperties: false },
				),
				{ minItems: 1 },
			),
		),
		ts: PositiveInteger,
	}),
})
