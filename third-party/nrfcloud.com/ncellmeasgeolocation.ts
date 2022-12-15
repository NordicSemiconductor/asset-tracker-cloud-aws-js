import { SSMClient } from '@aws-sdk/client-ssm'
import { Static, TObject, TProperties } from '@sinclair/typebox'
import { URL } from 'url'
import { validateWithJSONSchema } from '../../api/validateWithJSONSchema'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { fromEnv } from '../../util/fromEnv'
import { apiClient } from './apiclient'
import { locateResultSchema } from './locate'
import {
	ncellMeasLocateInputSchema,
	ncellMeasLocateRequestSchema,
} from './ncellMeasLocateSchema'
import { getCellLocationApiSettings } from './settings'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const settingsPromise = getCellLocationApiSettings({
	ssm: new SSMClient({}),
	stackName,
})()

const validateInput = validateWithJSONSchema(ncellMeasLocateInputSchema)

export const handler = async (
	ncellmeas: Static<typeof ncellMeasLocateInputSchema>,
): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(ncellmeas))
	const maybeValidInput = validateInput(ncellmeas)
	if ('error' in maybeValidInput) {
		console.error(JSON.stringify(maybeValidInput))
		return {
			located: false,
		}
	}
	const { nw, report } = maybeValidInput

	if (nw.includes('NB-IoT')) {
		console.error(`Resolution of NB-IoT cells not yet supported.`)
		return {
			located: false,
		}
	}

	const { serviceKey, teamId, endpoint } = await settingsPromise
	const c = apiClient({ endpoint: new URL(endpoint), serviceKey, teamId })

	const maybeCellGeolocation = await c.post({
		resource: 'location/ground-fix',
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
		requestSchema:
			ncellMeasLocateRequestSchema as unknown as TObject<TProperties>,
		responseSchema: locateResultSchema,
	})
	if ('error' in maybeCellGeolocation) {
		console.log(maybeCellGeolocation)
		console.error(JSON.stringify(maybeCellGeolocation))
		return {
			located: false,
		}
	}
	const { lat, lon, uncertainty } = maybeCellGeolocation
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
