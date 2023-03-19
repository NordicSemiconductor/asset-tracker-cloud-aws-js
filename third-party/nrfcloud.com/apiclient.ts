import type { Static, TObject, TProperties } from '@sinclair/typebox'
import Ajv from 'ajv'
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import { request as nodeRequest, RequestOptions } from 'https'
import type { URL } from 'url'
import { ErrorInfo, ErrorType } from '../../api/ErrorInfo.js'
import { createToken } from './createToken.js'

const ajv = new Ajv()
// see @https://github.com/sinclairzx81/typebox/issues/51
ajv.addKeyword('kind')
ajv.addKeyword('modifier')

/**
 * Provides custom encoding of arrays
 */
export const toQueryString = (query: Record<string, any>): string => {
	if (Object.entries(query).length === 0) return ''
	const parts = Object.entries(query).map(([k, v]) => {
		if (Array.isArray(v)) return `${encodeURIComponent(k)}=${v.join(',')}`
		return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
	})
	return `?${parts.join('&')}`
}

const validate =
	<Schema extends TObject<TProperties>>({
		schema,
		errorType,
		errorMessage,
	}: {
		schema: Schema
		errorType: ErrorType
		errorMessage: string
	}) =>
	(
		payload: Record<string, any>,
	): { error: ErrorInfo } | Static<typeof schema> => {
		const v = ajv.compile(schema)
		const valid = v(payload)
		if (valid !== true) {
			return {
				error: {
					type: errorType,
					message: errorMessage,
					detail: {
						errors: v.errors,
						input: payload,
					},
				},
			}
		}
		return payload as Static<typeof schema>
	}

const doRequest =
	({
		endpoint,
		serviceKey,
		teamId,
		method,
	}: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	async ({
		resource,
		payload,
		headers,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
	}) =>
		new Promise<Buffer>((resolve, reject) => {
			const options: RequestOptions = jsonRequestOptions({
				endpoint,
				resource:
					method === 'GET' ? `${resource}${toQueryString(payload)}` : resource,
				method,
				teamId,
				serviceKey,
				headers,
			})

			console.debug(
				JSON.stringify({ doRequest: { options, payload } }, null, 2),
			)

			const req = nodeRequest(options, (res) => {
				const body: Buffer[] = []
				res.on('data', (d) => {
					body.push(d)
				})
				res.on('end', () => {
					console.debug(
						JSON.stringify({
							doRequest: {
								response: {
									statusCode: res.statusCode,
									headers: res.headers,
									body: Buffer.concat(body).toString(),
								},
							},
						}),
					)

					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						return reject(
							new Error(
								`Error ${res.statusCode}: "${new Error(
									Buffer.concat(body).toString('utf-8'),
								)}"`,
							),
						)
					}

					resolve(Buffer.concat(body))
				})
			})
			req.on('error', (e) => {
				reject(new Error(e.message))
			})
			if (method === 'POST') {
				req.write(JSON.stringify(payload))
			}
			req.end()
		})

const reqJSON =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	async <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
		responseSchema: Response
	}): Promise<{ error: ErrorInfo } | Static<typeof responseSchema>> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)
		if ('error' in maybeValidPayload) return maybeValidPayload

		let resData: Buffer
		try {
			resData = await doRequest(cfg)({
				resource,
				payload,
				headers: {
					...headers,
					'Content-Type': 'application/json',
				},
			})
		} catch (err) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (err as Error).message,
				},
			}
		}

		let res: Static<typeof responseSchema>
		try {
			res = JSON.parse(resData.toString('utf-8'))
		} catch (err) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: `Failed to parse payload as JSON "${resData.toString(
						'utf-8',
					)}"`,
				},
			}
		}

		const maybeValidResponse = validate({
			schema: responseSchema,
			errorType: ErrorType.BadGateway,
			errorMessage: 'Response validation failed!',
		})(res)
		return maybeValidResponse
	}

const head =
	({
		endpoint,
		serviceKey,
		teamId,
	}: {
		endpoint: URL
		serviceKey: string
		teamId: string
	}) =>
	async <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		method,
		requestSchema,
	}: {
		resource: string
		method: 'GET' | 'POST'
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
	}): Promise<{ error: ErrorInfo } | IncomingHttpHeaders> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)
		if ('error' in maybeValidPayload)
			return maybeValidPayload as { error: ErrorInfo }

		try {
			return new Promise<IncomingHttpHeaders>((resolve, reject) => {
				const options: RequestOptions = {
					...jsonRequestOptions({
						endpoint,
						resource:
							method === 'GET'
								? `${resource}${toQueryString(payload)}`
								: resource,
						method,
						teamId,
						serviceKey,
						headers,
					}),
					method: 'HEAD',
				}

				console.debug(JSON.stringify({ head: { options } }))

				const req = nodeRequest(options, (res) => {
					console.debug(
						JSON.stringify({
							head: {
								response: {
									statusCode: res.statusCode,
									headers: res.headers,
								},
							},
						}),
					)
					if (res.statusCode === undefined) {
						return reject(new Error('No response received!'))
					}
					if (res.statusCode >= 400) {
						return reject(new Error(`Error ${res.statusCode}`))
					}
					resolve(res.headers)
				})
				req.on('error', (e) => {
					reject(new Error(e.message))
				})
				req.end()
			})
		} catch (err) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (err as Error).message,
				},
			}
		}
	}

const reqBinary =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	async <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
	}): Promise<{ error: ErrorInfo } | Buffer> => {
		const maybeValidPayload = validate({
			schema: requestSchema,
			errorMessage: 'Input validation failed!',
			errorType: ErrorType.BadRequest,
		})(payload)
		if ('error' in maybeValidPayload)
			return maybeValidPayload as { error: ErrorInfo }

		try {
			return doRequest(cfg)({
				resource,
				payload,
				headers: { ...headers, Accept: 'application/octet-stream' },
			})
		} catch (err) {
			return {
				error: {
					type: ErrorType.BadGateway,
					message: (err as Error).message,
				},
			}
		}
	}

export const apiClient = ({
	endpoint,
	serviceKey,
	teamId,
}: {
	endpoint: URL
	serviceKey: string
	teamId: string
}): {
	post: <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
		responseSchema: Response
	}) => Promise<{ error: ErrorInfo } | Static<typeof responseSchema>>
	get: <
		Request extends TObject<TProperties>,
		Response extends TObject<TProperties>,
	>({
		resource,
		payload,
		headers,
		requestSchema,
		responseSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
		responseSchema: Response
	}) => Promise<{ error: ErrorInfo } | Static<typeof responseSchema>>
	head: <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		method: 'GET' | 'POST'
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
	}) => Promise<{ error: ErrorInfo } | OutgoingHttpHeaders>
	getBinary: <Request extends TObject<TProperties>>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
	}) => Promise<{ error: ErrorInfo } | Buffer>
} => ({
	post: reqJSON({
		endpoint,
		serviceKey,
		teamId,
		method: 'POST',
	}),
	get: reqJSON({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
	head: head({
		endpoint,
		serviceKey,
		teamId,
	}),
	getBinary: reqBinary({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
})
const jsonRequestOptions = ({
	endpoint,
	resource,
	method,
	teamId,
	serviceKey,
	headers,
}: {
	endpoint: URL
	resource: string
	method: string
	teamId: string
	serviceKey: string
	headers: OutgoingHttpHeaders | undefined
}): RequestOptions => ({
	host: endpoint.hostname,
	port: 443,
	path: `${endpoint.pathname.replace(/\/+$/g, '')}/v1/${resource}`,
	method,
	agent: false,
	headers: {
		Authorization: `Bearer ${createToken(teamId, serviceKey)}`,
		...headers,
	},
})
