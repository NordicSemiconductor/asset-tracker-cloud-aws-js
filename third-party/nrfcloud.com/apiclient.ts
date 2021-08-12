import {
	chain,
	left,
	right,
	TaskEither,
	tryCatch,
	map,
} from 'fp-ts/lib/TaskEither'
import { request as nodeRequest, RequestOptions } from 'https'
import { URL } from 'url'
import { ErrorInfo, ErrorType } from '../../api/ErrorInfo'
import { Static, TSchema } from '@sinclair/typebox'
import { pipe } from 'fp-ts/lib/function'
import Ajv from 'ajv'
import * as jwt from 'jsonwebtoken'
import { OutgoingHttpHeaders } from 'http'
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
	(
		payload: Record<string, any>,
	): TaskEither<ErrorInfo, Static<typeof schema>> => {
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
			const options: RequestOptions = {
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
					'Content-Type': 'application/json',
					...headers,
				},
			}

			console.debug(JSON.stringify(options))

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
			map((b) => J.parse(b.toString('utf-8'))),
			chain(
				validate({
					schema: responseSchema,
					errorType: ErrorType.BadGateway,
					errorMessage: 'Response validation failed!',
				}),
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
	getBinary: reqBinary({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
})
