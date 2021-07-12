import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from './settings'
import { Static, Type } from '@sinclair/typebox'
import { apiClient } from './apiclient'
import { isLeft } from 'fp-ts/lib/Either'
import { locateResultSchema } from './locate'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfConnectForCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

const PositiveInteger = Type.Integer({ minimum: 1 })

const ncellmeasSchema = Type.Object({
	mcc: Type.Integer({ minimum: 100, maximum: 999 }),
	mnc: Type.Integer({ minimum: 0, maximum: 99 }),
	cell: PositiveInteger,
	area: PositiveInteger,
	earfcn: PositiveInteger,
	adv: PositiveInteger,
	rsrp: PositiveInteger,
	rsrq: PositiveInteger,
	nmr: Type.Optional(
		Type.Array(
			Type.Object(
				{
					cell: PositiveInteger,
					earfcn: PositiveInteger,
					rsrp: PositiveInteger,
					rsrq: PositiveInteger,
				},
				{ additionalProperties: false },
			),
			{ minItems: 1 },
		),
	),
})

const inputSchema = Type.Object({
	roam: Type.Object({
		nw: Type.String({ minLength: 1 }),
	}),
	report: Type.Intersect([
		ncellmeasSchema,
		Type.Object({ ts: PositiveInteger }),
	]),
})

const locateRequestSchema = Type.Dict(
	Type.Array(ncellmeasSchema, { minItems: 1 }),
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

	const {
		roam: { nw },
		report,
	} = valid.right
	const { ts, ...reportWithoutTs } = report
	const maybeCeollGeolocation = await c.post({
		resource: 'location/locate/nRFAssetTrackerForAWS',
		payload: {
			[nw.includes('NB-IoT') ? 'nbiot' : `lte`]: [reportWithoutTs],
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
