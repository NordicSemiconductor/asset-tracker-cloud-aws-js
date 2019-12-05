import { SSM } from 'aws-sdk'
import { CelGeoInput } from '../CelGeoInput'
import { CelGeoResponse } from '../CelGeoResponse'
import { request as nodeRequest } from 'https'
import { parse } from 'url'
import { getApiSettings } from './getApiSettings'

const fetchSettings = getApiSettings({ ssm: new SSM() })

export const handler = async ({
	roaming: cell,
}: CelGeoInput): Promise<CelGeoResponse> => {
	try {
		const { apiKey, endpoint } = await fetchSettings({
			api: 'unwiredlabs',
		})

		if (!apiKey) {
			throw new Error('No API key configured!')
		}

		const { hostname, path } = parse(endpoint)

		if (!hostname) {
			throw new Error(`No hostname found in "${endpoint}"!`)
		}

		// See https://eu1.unwiredlabs.com/docs-html/index.html#response
		const {
			status,
			lat,
			lon,
		}: {
			status: 'ok' | 'error'
			message?: string
			balance: number
			balance_slots?: number
			lat: number
			lon: number
			accuracy: number
			aged?: boolean
			fallback?: 'ipf' | 'lacf' | 'scf'
			// address: string (not requested)
			// address_details?: string (not requested)
		} = await new Promise((resolve, reject) => {
			const options = {
				host: hostname,
				path: `${path ? path.replace(/\/*$/, '') : ''}/v2/process.php`,
				method: 'POST',
				agent: false,
			}

			const req = nodeRequest(options, res => {
				console.debug(
					JSON.stringify({
						response: {
							statusCode: res.statusCode,
							headers: res.headers,
						},
					}),
				)
				res.on('data', d => {
					const responseBody = JSON.parse(d.toString())
					console.debug(
						JSON.stringify({
							responseBody,
						}),
					)
					if (!res.statusCode) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						reject(new Error(responseBody.description))
					}
					resolve(responseBody)
				})
			})

			req.on('error', e => {
				reject(new Error(e.message))
			})

			const payload = JSON.stringify({
				token: apiKey,
				radio: 'lte',
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
				...cell,
				lat,
				lng: lon,
				located: true,
			}
		}
		return {
			...cell,
			located: false,
		}
	} catch (err) {
		console.error(JSON.stringify({ error: err }))
		return {
			...cell,
			located: false,
		}
	}
}
