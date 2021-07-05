import { SSMClient } from '@aws-sdk/client-ssm'
import { request as nodeRequest, RequestOptions } from 'https'
import { URL } from 'url'
import { MaybeCellGeoLocation } from '../../cellGeolocation/stepFunction/types'
import { Cell } from '../../cellGeolocation/geolocateCell'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from './settings'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfConnectForCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(cell))
	try {
		const { apiKey, endpoint } = await fetchSettings()
		const { hostname, pathname } = new URL(endpoint)

		// See https://api.nrfcloud.com/v1#operation/GetSingleCellLocation
		const {
			location: { lat, lng },
			accuracy,
		}: {
			location: {
				lat: number
				lng: number
			}
			accuracy: number
		} = await new Promise((resolve, reject) => {
			const options: RequestOptions = {
				host: hostname,
				port: 443,
				path: `${
					pathname?.replace(/\/*$/, '') ?? ''
				}/v1/location/locate/nRFAssetTrackerForAWS`,
				method: 'POST',
				agent: false,
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
			}

			console.debug(
				JSON.stringify(options).replace(apiKey, `${apiKey.substr(0, 3)}***`),
			)

			const req = nodeRequest(options, (res) => {
				console.debug(
					JSON.stringify({
						response: {
							statusCode: res.statusCode,
							headers: res.headers,
						},
					}),
				)
				const body: Uint8Array[] = []
				res.on('data', (d) => {
					body.push(d)
				})
				res.on('end', () => {
					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						return reject(
							new Error(
								`Error ${res.statusCode}: "${new Error(
									Buffer.concat(body).toString(),
								)}"`,
							),
						)
					}
					resolve(JSON.parse(Buffer.concat(body).toString()))
				})
			})
			req.on('error', (e) => {
				reject(new Error(e.message))
			})
			const mccmnc = cell.mccmnc.toFixed(0)
			req.write(
				JSON.stringify({
					[cell.nw === NetworkMode.NBIoT ? 'nbiot' : `lte`]: [
						{
							cid: cell.cell,
							mcc: parseInt(mccmnc.substr(0, mccmnc.length - 2), 10),
							mnc: parseInt(mccmnc.substr(-2), 10),
							tac: cell.area,
						},
					],
				}),
			)
			req.end()
		})

		console.debug(JSON.stringify({ lat, lng, accuracy }))

		if (lat !== undefined && lng !== undefined) {
			return {
				lat,
				lng,
				accuracy,
				located: true,
			}
		}
	} catch (err) {
		console.error(JSON.stringify({ error: err.message }))
	}
	return {
		located: false,
	}
}
