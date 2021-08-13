import {
	chain,
	left,
	right,
	TaskEither,
	tryCatch,
	fromEither,
	map,
} from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'
import { request as nodeRequest, RequestOptions } from 'https'
import { URL } from 'url'
import { ErrorInfo, ErrorType } from '../../api/ErrorInfo'
import { Static, TSchema } from '@sinclair/typebox'
import { pipe } from 'fp-ts/lib/function'
import Ajv from 'ajv'
import * as jwt from 'jsonwebtoken'
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http'
import * as J from 'fp-ts/Json'

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
	<Schema extends TSchema>({
		schema,
		errorType,
		errorMessage,
	}: {
		schema: Schema
		errorType: ErrorType
		errorMessage: string
	}) =>
	(payload: J.Json): TaskEither<ErrorInfo, Static<typeof schema>> => {
		const v = ajv.compile(schema)
		const valid = v(payload)
		if (valid !== true) {
			return left({
				type: errorType,
				message: errorMessage,
				detail: {
					errors: v.errors,
					input: payload,
				},
			})
		}
		return right(payload as Static<typeof schema>)
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
	({
		resource,
		payload,
		headers,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
	}) =>
	async () =>
		new Promise<Buffer>((resolve, reject) => {
			const options: RequestOptions = jsonRequestOptions({
				endpoint,
				resource,
				method,
				payload,
				teamId,
				serviceKey,
				headers,
			})

			console.debug(JSON.stringify({ doRequest: doRequest }))

			const req = nodeRequest(options, (res) => {
				const body: Uint8Array[] = []
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
			if (method === 'POST') req.write(JSON.stringify(payload))
			req.end()
		})

const reqJSON =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	<Request extends TSchema, Response extends TSchema>({
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
	}): TaskEither<ErrorInfo, Static<typeof responseSchema>> =>
		pipe(
			validate({
				schema: requestSchema,
				errorMessage: 'Input validation failed!',
				errorType: ErrorType.BadRequest,
			})(payload),
			chain((payload) =>
				tryCatch<ErrorInfo, Buffer>(
					doRequest(cfg)({ resource, payload, headers }),
					(err) => {
						return {
							type: ErrorType.BadGateway,
							message: (err as Error).message,
						}
					},
				),
			),
			chain((buffer) =>
				pipe(
					buffer.toString('utf-8'),
					J.parse,
					E.mapLeft(
						() =>
							({
								type: ErrorType.BadGateway,
								message: `Failed to parse payload as JSON "${buffer.toString(
									'utf-8',
								)}"`,
							} as ErrorInfo),
					),
					fromEither,
				),
			),
			map((j) => j),
			chain(
				validate({
					schema: responseSchema,
					errorType: ErrorType.BadGateway,
					errorMessage: 'Response validation failed!',
				}),
			),
		)

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
	<Request extends TSchema>({
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
	}): TaskEither<ErrorInfo, IncomingHttpHeaders> =>
		pipe(
			validate({
				schema: requestSchema,
				errorMessage: 'Input validation failed!',
				errorType: ErrorType.BadRequest,
			})(payload),
			chain((payload) =>
				tryCatch<ErrorInfo, IncomingHttpHeaders>(
					async () =>
						new Promise<IncomingHttpHeaders>((resolve, reject) => {
							const options: RequestOptions = {
								...jsonRequestOptions({
									endpoint,
									resource,
									method,
									payload,
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
						}),
					(err) => {
						return {
							type: ErrorType.BadGateway,
							message: (err as Error).message,
						}
					},
				),
			),
		)

const reqBinary =
	(cfg: {
		endpoint: URL
		serviceKey: string
		teamId: string
		method: 'GET' | 'POST'
	}) =>
	<Request extends TSchema>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: OutgoingHttpHeaders
		requestSchema: Request
	}): TaskEither<ErrorInfo, Buffer> =>
		pipe(
			validate({
				schema: requestSchema,
				errorMessage: 'Input validation failed!',
				errorType: ErrorType.BadRequest,
			})(payload),
			chain((payload) =>
				tryCatch<ErrorInfo, Buffer>(
					doRequest(cfg)({ resource, payload, headers }),
					(err) => {
						return {
							type: ErrorType.BadGateway,
							message: (err as Error).message,
						}
					},
				),
			),
		)

export const apiClient = ({
	endpoint,
	serviceKey,
	teamId,
}: {
	endpoint: URL
	serviceKey: string
	teamId: string
}): {
	post: <Request extends TSchema, Response extends TSchema>({
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
	}) => TaskEither<ErrorInfo, Static<typeof responseSchema>>
	get: <Request extends TSchema, Response extends TSchema>({
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
	}) => TaskEither<ErrorInfo, Static<typeof responseSchema>>
	head: <Request extends TSchema>({
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
	}) => TaskEither<ErrorInfo, OutgoingHttpHeaders>
	getBinary: <Request extends TSchema>({
		resource,
		payload,
		headers,
		requestSchema,
	}: {
		resource: string
		payload: Record<string, any>
		headers?: Record<string, string>
		requestSchema: Request
	}) => TaskEither<ErrorInfo, Buffer>
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
	payload,
	teamId,
	serviceKey,
	headers,
}: {
	endpoint: URL
	resource: string
	method: string
	payload: Record<string, any>
	teamId: string
	serviceKey: string
	headers: OutgoingHttpHeaders | undefined
}): RequestOptions => ({
	host: endpoint.hostname,
	port: 443,
	path: `${endpoint.pathname.replace(/\/+$/g, '')}/v1/${resource}${
		method === 'GET' ? `${toQueryString(payload)}` : ''
	}`,
	method,
	agent: false,
	headers: {
		Authorization: `Bearer ${jwt.sign({ aud: teamId }, serviceKey, {
			algorithm: 'ES256',
		})}`,
		...headers,
	},
})
