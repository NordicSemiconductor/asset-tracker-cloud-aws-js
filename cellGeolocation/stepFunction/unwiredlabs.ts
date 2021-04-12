import { SSMClient } from '@aws-sdk/client-ssm'
import { request as nodeRequest } from 'https'
import { URL } from 'url'
import { MaybeCellGeoLocation } from './types'
import { Cell } from '../geolocateCell'
import { fromEnv } from '../../util/fromEnv'
import { getNrfConnectForCloudApiSettings } from '../settings/nrfconnectforcloud'
import * as querystring from 'querystring'
import { RequestOptions } from 'node:https'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getNrfConnectForCloudApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(cell))
	try {
		const { apiKey, endpoint, apiDevice } = await fetchSettings()
		const { hostname, pathname } = new URL(endpoint)

		// See https://api.nrfcloud.com/v1#operation/GetSingleCellLocation
		const {
			lat,
			lon,
			alt,
			uncertainty,
		}: {
			lat: number
			lon: number
			alt: number
			uncertainty: number
		} = await new Promise((resolve, reject) => {
			const options: RequestOptions = {
				host: hostname,
				path: `${
					pathname?.replace(/\/*$/, '') ?? ''
				}/v1/location/single-cell?${querystring.stringify({
					deviceIdentifier: apiDevice,
					eci: cell.cell,
					format: 'json',
					mcc: cell.mccmnc.toFixed(0).substr(0, -3),
					mnc: cell.mccmnc.toFixed(0).substr(-2),
					tac: cell.area,
				})}`,
				method: 'POST',
				agent: false,
				headers: {
					authorization: `Bearer ${apiKey}`,
				},
			}

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
							`Error ${res.statusCode}: "${new Error(
								Buffer.concat(body).toString(),
							)}"`,
						)
					}
					resolve(JSON.parse(Buffer.concat(body).toString()))
				})
			})
			req.on('error', (e) => {
				reject(new Error(e.message))
			})

			req.end()
		})

		console.debug(JSON.stringify({ lat, lon, alt, uncertainty }))

		if (lat !== undefined && lon !== undefined) {
			return {
				lat,
				lng: lon,
				accuracy: uncertainty,
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
