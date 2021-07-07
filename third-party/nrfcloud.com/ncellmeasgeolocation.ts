import { SSMClient } from '@aws-sdk/client-ssm'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from './settings'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'
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

const ncellmeasSchema = Type.Object(
	{
		mcc: Type.Integer({ minimum: 100, maximum: 999 }),
		mnc: Type.Integer({ minimum: 1, maximum: 99 }),
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
	},
	{ additionalProperties: false },
)

const inputSchema = Type.Intersect([
	Type.Object(
		{
			nw: Type.Enum(NetworkMode),
		},
		{ additionalProperties: false },
	),
	ncellmeasSchema,
])

const locateRequestSchema = Type.Dict(ncellmeasSchema)

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

	const { nw, ...rest } = valid.right
	const maybeCeollGeolocation = await c.post({
		resource: 'location/locate/nRFAssetTrackerForAWS',
		payload: {
			[nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [rest],
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
