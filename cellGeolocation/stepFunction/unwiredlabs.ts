import { SSMClient } from '@aws-sdk/client-ssm'
import { request as nodeRequest } from 'https'
import { URL } from 'url'
import { MaybeCellGeoLocation } from './types.js'
import { Cell } from '../geolocateCell.js'
import { fromEnv } from '../../util/fromEnv.js'
import { getUnwiredLabsApiSettings } from '../settings/unwiredlabs.js'
import { NetworkMode } from '@nordicsemiconductor/cell-geolocation-helpers'

const { stackName } = fromEnv({ stackName: 'STACK_NAME' })(process.env)

const fetchSettings = getUnwiredLabsApiSettings({
	ssm: new SSMClient({}),
	stackName,
})

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
	console.log(JSON.stringify(cell))
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

		console.debug(JSON.stringify({ status, lat, lon }))

		if (status === 'ok' && lat !== undefined && lon !== undefined) {
			return {
				lat,
				lng: lon,
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
