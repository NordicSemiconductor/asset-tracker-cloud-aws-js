import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, TObject, TProperties, Type } from '@sinclair/typebox'
import { URL } from 'url'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { MaybeLocation } from '../../geolocation/types'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import {
	EARFCN,
	groundFixRequestSchema,
	RSRP,
	RSRQ,
	TimingAdvance,
} from './groundFixRequestSchema'
import { locateResultSchema } from './locate'
import { getGroundFixApiSettings } from './settings'

const { stackName } = fromEnv({
	stackName: 'STACK_NAME',
})(process.env)

const settingsPromise = getGroundFixApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const networkSurveyLocateInputSchema = Type.Object({
	surveyId: Type.String(),
	deviceId: Type.String(),
	timestamp: Type.Date(),
	nw: Type.String({ minLength: 1 }),
	lte: Type.Optional(
		Type.Object({
			mcc: Type.Integer({ minimum: 100, maximum: 999 }),
			mnc: Type.Integer({ minimum: 0, maximum: 999 }),
			cell: Type.Integer({ minimum: 1 }),
			area: Type.Integer({ minimum: 1 }),
			earfcn: EARFCN,
			adv: TimingAdvance,
			rsrp: RSRP,
			rsrq: RSRQ,
			nmr: Type.Optional(
				Type.Array(
					Type.Object(
						{
							cell: Type.Integer({ minimum: 1 }),
							earfcn: Type.Integer({ minimum: 1 }),
							rsrp: RSRP,
							rsrq: RSRQ,
						},
						{ additionalProperties: false },
					),
					{ minItems: 1 },
				),
			),
			ts: Type.Integer({ minimum: 1 }),
		}),
	),
	wifi: Type.Optional(
		Type.Object({
			ts: Type.Integer({ minimum: 1 }),
			aps: Type.Array(Type.String()),
		}),
	),
})

const validateInput = validateWithJSONSchema(networkSurveyLocateInputSchema)

export const handler = async (
	event: Static<typeof networkSurveyLocateInputSchema>,
): Promise<MaybeLocation> => {
	console.log(JSON.stringify(event))

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const maybeValidInput = validateInput(event)
	if ('error' in maybeValidInput) {
		console.error(JSON.stringify(maybeValidInput))
		return {
			located: false,
		}
	}

	// Request to nRFCloud
	const payload: Static<typeof groundFixRequestSchema> = {}
	if (maybeValidInput.wifi !== undefined) {
		payload.wifi = {
			accessPoints: maybeValidInput.wifi.aps.map((macAddress) => ({
				macAddress,
			})),
		}
	}
	if (maybeValidInput.lte !== undefined) {
		const report = maybeValidInput.lte
		payload.lte = [
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
		]
	}

	const maybeWifiGeolocation = await c.post({
		resource: 'location/ground-fix',
		payload,
		requestSchema: groundFixRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})

	if ('error' in maybeWifiGeolocation) {
		console.error(JSON.stringify(maybeWifiGeolocation))
		return {
			located: false,
		}
	}

	const { lat, lon, uncertainty } = maybeWifiGeolocation
	console.debug(JSON.stringify({ lat, lng: lon, accuracy: uncertainty }))
	return {
		lat,
		lng: lon,
		accuracy: uncertainty,
		located: true,
	}
}
