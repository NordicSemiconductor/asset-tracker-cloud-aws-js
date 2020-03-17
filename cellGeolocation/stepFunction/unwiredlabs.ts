import { SSM } from 'aws-sdk'
import { request as nodeRequest } from 'https'
import { parse } from 'url'
import { MaybeCellGeoLocation } from './types'
import { Cell } from '../geolocateCell'

export const getApiSettings = ({ ssm }: { ssm: SSM }) => async ({
	api,
}: {
	api: 'unwiredlabs'
}) => {
	const Path = `/bifravst/cellGeoLocation/${api}`
	const { Parameters } = await ssm
		.getParametersByPath({
			Path,
			Recursive: true,
		})
		.promise()

	const apiKey = Parameters?.find(
		({ Name }) => Name?.replace(`${Path}/`, '') === 'apiKey',
	)?.Value
	const endpoint =
		Parameters?.find(({ Name }) => Name?.replace(`${Path}/`, '') === 'endpoint')
			?.Value ?? 'https://eu1.unwiredlabs.com/'

	return {
		apiKey,
		endpoint,
	}
}

const fetchSettings = getApiSettings({ ssm: new SSM() })

export const handler = async (cell: Cell): Promise<MaybeCellGeoLocation> => {
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
				lat,
				lng: lon,
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
