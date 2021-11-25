import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { getCellLocationApiSettings } from './settings'
import { Static, TObject, TProperties, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { locateResultSchema } from './locate'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const settingsPromise = getCellLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })
const RSRP = Type.Integer({ minimum: -199, maximum: 0, title: 'RSRP' })
const RSRQ = Type.Integer({ minimum: -99, maximum: 0, title: 'RSRQ' })
const TimingAdvance = Type.Integer({
	minimum: 0,
	maximum: 20512,
	title: 'Timing advance',
})

const inputSchema = Type.Object({
	nw: Type.String({ minLength: 1 }),
	report: Type.Object({
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
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

const locateRequestSchema = Type.Record(
	Type.Union([Type.Literal('nbiot'), Type.Literal('lte')]),
	Type.Array(
		Type.Object(
			{
				mcc: Type.Integer({ minimum: 100, maximum: 999 }),
				mnc: Type.Integer({ minimum: 0, maximum: 99 }),
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
	),
)

const validateInput = validateWithJSONSchema(inputSchema)

export const handler = async (
	ncellmeas: Static<typeof inputSchema>,
): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(ncellmeas))
	const valid = validateInput(ncellmeas)
	if (isLeft(valid)) {
		console.error(JSON.stringify(valid.left))
		return {
			located: false,
		}
	}
	const { nw, report } = valid.right

	if (nw.includes('NB-IoT')) {
		console.error(`Resolution of NB-IoT cells not yet supported.`)
		return {
			located: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const maybeCeollGeolocation = await c.post({
		resource: 'location/cell',
		payload: {
			[nw.includes('NB-IoT') ? 'nbiot' : `lte`]: [
				{
					mcc: report.mcc,
					mnc: report.mnc,
					eci: report.cell,
					tac: report.area,
					earfcn: report.earfcn,
					adv: report.adv,
					rsrp: report.rsrp,
					rsrq: report.rsrq,
					nmr: report.nmr?.map(({ cell, ...rest }) => ({
						pci: cell,
						...rest,
					})),
				},
			],
		},
		requestSchema: locateRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})()
	if (isLeft(maybeCeollGeolocation)) {
		console.error(JSON.stringify(maybeCeollGeolocation.left))
		return {
			located: false,
		}
	}
	const { lat, lon, uncertainty } = maybeCeollGeolocation.right
	console.debug(
		JSON.stringify({ lat, lng: lon, accuracy: uncertainty, located: true }),
	)
	return {
		lat,
		lng: lon,
		accuracy: uncertainty,
		located: true,
	}
}
