import { chain, left, right, TaskEither, tryCatch } from 'fp-ts/lib/TaskEither'
import { request as nodeRequest, RequestOptions } from 'https'
import { URL } from 'url'
import { ErrorInfo, ErrorType } from '../../api/ErrorInfo'
import { Static, TSchema } from '@sinclair/typebox'
import { pipe } from 'fp-ts/lib/function'
import Ajv from 'ajv'
import * as jwt from 'jsonwebtoken'

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

const req =
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
	<Request extends TSchema, Response extends TSchema>({
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
	}): TaskEither<ErrorInfo, Static<typeof responseSchema>> =>
		pipe(
			validate({
				schema: requestSchema,
				errorMessage: 'Input validation failed!',
				errorType: ErrorType.BadRequest,
			})(payload),
			chain((input) =>
				tryCatch<ErrorInfo, Static<typeof responseSchema>>(
					async () =>
						new Promise((resolve, reject) => {
							const options: RequestOptions = {
								host: endpoint.hostname,
								port: 443,
								path: `${endpoint.pathname.replace(
									/\/+$/g,
									'',
								)}/v1/${resource}${
									method === 'GET' ? `${toQueryString(payload)}` : ''
								}`,
								method,
								agent: false,
								headers: {
									Authorization: `Bearer ${jwt.sign(
										{ aud: teamId },
										serviceKey,
										{ algorithm: 'ES256' },
									)}`,
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
													Buffer.concat(body).toString(),
												)}"`,
											),
										)
									}
									const bodyAsString = Buffer.concat(body).toString()
									if (res.headers['content-type']?.includes('json') ?? false) {
										let response: Record<string, any>
										try {
											response = JSON.parse(bodyAsString)
											console.debug(
												JSON.stringify({
													response: {
														body: response,
													},
												}),
											)
										} catch {
											throw new Error(
												`Failed to parse response as JSON: ${bodyAsString}`,
											)
										}
										resolve(response as Static<typeof responseSchema>)
									}
									resolve(bodyAsString as Static<typeof responseSchema>)
								})
							})
							req.on('error', (e) => {
								reject(new Error(e.message))
							})
							if (method === 'POST') req.write(JSON.stringify(input))
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
			chain(
				validate({
					schema: responseSchema,
					errorType: ErrorType.BadGateway,
					errorMessage: 'Response validation failed!',
				}),
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
} => ({
	post: req({
		endpoint,
		serviceKey,
		teamId,
		method: 'POST',
	}),
	get: req({
		endpoint,
		serviceKey,
		teamId,
		method: 'GET',
	}),
})
