import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { getNrfCloudApiSettings } from './settings'
import { Static, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { locateResultSchema } from './locate'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const PositiveInteger = Type.Integer({ minimum: 1, title: 'positive integer' })
const RSRP = Type.Integer({ minimum: -255, maximum: 255, title: 'RSRP' })
const RSRQ = Type.Integer({ minimum: -30, maximum: 255, title: 'RSRQ' })

const inputSchema = Type.Object({
	nw: Type.String({ minLength: 1 }),
	report: Type.Object({
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 0, maximum: 99 }),
		cell: PositiveInteger,
		area: PositiveInteger,
		earfcn: PositiveInteger,
		adv: PositiveInteger,
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
				cid: PositiveInteger,
				tac: PositiveInteger,
				earfcn: PositiveInteger,
				adv: PositiveInteger,
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

	const { apiKey, endpoint } = await fetchSettings()
	const c = apiClient({ endpoint: new URL(endpoint), apiKey })

	const { nw, report } = valid.right
	const maybeCeollGeolocation = await c.post({
		resource: 'location/locate/nRFAssetTrackerForAWS',
		payload: {
			[nw.includes('NB-IoT') ? 'nbiot' : `lte`]: [
				{
					mcc: report.mcc,
					mnc: report.mnc,
					cid: report.cell,
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
		requestSchema: locateRequestSchema,
		responseSchema: locateResultSchema,
	})()
	if (isLeft(maybeCeollGeolocation)) {
		console.error(JSON.stringify(maybeCeollGeolocation.left))
		return {
			located: false,
		}
	}
	const {
		location: { lat, lng },
		accuracy,
	} = maybeCeollGeolocation.right
	console.debug(JSON.stringify({ lat, lng, accuracy }))
	return {
		lat,
		lng,
		accuracy,
		located: true,
	}
}
