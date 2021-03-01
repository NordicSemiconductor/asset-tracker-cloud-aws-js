import { SSMClient } from '@aws-sdk/client-ssm'
import { request as nodeRequest } from 'https'
import { URL } from 'url'
import { MaybeCellGeoLocation } from './types'
import { Cell } from '../geolocateCell'
import { fromEnv } from '../../util/fromEnv'
import { getUnwiredLabsApiSettings } from '../settings/unwiredlabs'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getUnwiredLabsApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	try {
		const { apiKey, endpoint } = await fetchSettings()
		const { hostname, pathname } = new URL(endpoint)

		// See https://eu1.unwiredlabs.com/docs-html/index.html#response
		const {
			status,
			lat,
			lon,
			accuracy,
		}: {
			status: 'ok' | 'error'
			message?: string
			balance: number
			balance_slots?: number
			lat: number
			lon: number
			accuracy: number
			aged?: boolean
			fallback?: 'ipf' | 'lacf' | 'scf' | 'ncf'
			// address: string (not requested)
			// address_details?: string (not requested)
		} = await new Promise((resolve, reject) => {
			const options = {
				host: hostname,
				path: `${pathname?.replace(/\/*$/, '') ?? ''}/v2/process.php`,
				method: 'POST',
				agent: false,
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
				res.on('data', (d) => {
					const responseBody = JSON.parse(d.toString())
					console.debug(
						JSON.stringify({
							responseBody,
						}),
					)
					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						reject(new Error(responseBody.description))
					}
					resolve(responseBody)
				})
			})

			req.on('error', (e) => {
				reject(new Error(e.message))
			})

			const payload = JSON.stringify({
				token: apiKey,
				radio: cell.nw === NetworkMode.NBIoT ? 'nbiot' : 'lte',
				mcc: Math.floor(cell.mccmnc / 100),
				mnc: cell.mccmnc % 100,
				cells: [
					{
						lac: cell.area,
						cid: cell.cell,
					},
				],
			})
			console.log(payload.replace(apiKey, '***'))
			req.write(payload)
			req.end()
		})

		if (status === 'ok' && lat && lon) {
			return {
				lat,
				lng: lon,
				accuracy,
				located: true,
			}
		}
	} catch (err) {
		console.error(JSON.stringify({ error: err }))
	}
	return {
		located: false,
	}
}
