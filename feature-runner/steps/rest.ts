import {
	codeBlockOrThrow,
	type StepRunner,
	regExpMatchedStep,
	type Logger,
	type Step,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import type { World } from '../run-features.js'
import { matchChoice, matchInteger, matchString } from './util.js'
import { check, objectMatching } from 'tsmatchers'
import { retryCheck, type Options } from './retryCheck.js'

type RESTContext = {
	response?: {
		body?: string | Record<string, any>
		statusCode: number
		headers: Headers
	}
}

const client = ({
	url,
	method,
	body,
	log: { progress },
	context,
}: {
	url: URL
	method: 'GET' | 'POST' | 'PUT' | 'DELETE'
	body?: string
	log: Logger
	context: RESTContext
}) => {
	let res: Response | undefined

	return {
		statusCode: () => res?.status,
		response: () => res,
		send: async () => {
			progress(`${method} ${url}`)
			if (body !== undefined) {
				progress(`> ${body}`)
			}
			res = await fetch(url, {
				method,
				redirect: 'manual',
				body,
			})
			progress(`${res.status} ${res.statusText}`)
			let resBody: string | undefined = undefined
			if (parseInt(res.headers.get('content-length') ?? '0', 10) > 0) {
				if (
					res.headers.get('content-type')?.includes('application/json') ??
					false
				) {
					resBody = await res.json()
					progress(`< ${JSON.stringify(resBody)}`)
				} else {
					resBody = await res.text()
					progress(`< ${resBody}`)
				}
			}
			const awsTraceId = res.headers.get('x-amzn-trace-id')
			if (awsTraceId !== null) progress(`x-amzn-trace-id: ${awsTraceId}`)
			context.response = {
				body: resBody ?? '',
				headers: res.headers,
				statusCode: res.status,
			}
		},
	}
}

type RESTWorld = World & RESTContext
const steps = (): StepRunner<RESTWorld>[] => {
	let req: ReturnType<typeof client> | undefined = undefined
	return [
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^I ${matchChoice('method', [
						'GET',
						'POST',
						'PUT',
						'DELETE',
					])} (?:to )?${matchString('url')}(?<hasBody> with)?$`,
				),
				schema: Type.Object({
					method: Type.Union([
						Type.Literal('GET'),
						Type.Literal('POST'),
						Type.Literal('PUT'),
						Type.Literal('DELETE'),
					]),
					url: Type.String(),
					hasBody: Type.Optional(Type.Literal(' with')),
				}),
			},
			async ({
				match: { url: urlString, method, hasBody },
				context,
				step,
				log,
			}) => {
				const url = new URL(urlString)
				req = client({
					url,
					method,
					body: hasBody ? codeBlockOrThrow(step).code : undefined,
					log,
					context,
				})
				await req.send()
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the ${matchString(
						'header',
					)} response header should equal ${matchString('expectedValue')}$`,
				),
				schema: Type.Object({
					header: Type.String(),
					expectedValue: Type.String(),
				}),
			},
			async ({
				match: { header, expectedValue },
				context,
				log: { progress },
			}) => {
				const v = context.response?.headers.get(header)
				progress(v ?? '')
				check(v).is(expectedValue)
			},
		),
		regExpMatchedStep(
			{
				regExp: new RegExp(
					`^the response status code should equal ${matchInteger(
						'expectedStatus',
					)}$`,
				),
				schema: Type.Object({
					expectedStatus: Type.String(),
				}),
			},
			async ({ match: { expectedStatus }, step, log }) => {
				const retryConfig = parseComment(step)
				log.progress('retryConfig', JSON.stringify(retryConfig))
				await retryCheck(
					() => check(req?.statusCode()).is(parseInt(expectedStatus, 10)),
					async () => req?.send(),
					retryConfig,
				)
			},
		),
		<StepRunner<RESTWorld>>{
			match: (title) => /^the response body should equal$/.test(title),
			run: async ({ context, step, log: { progress } }) => {
				const { code: expected } = codeBlockOrThrow(step)

				const body = context.response?.body ?? {}
				progress(JSON.stringify(body))

				check(body).is(objectMatching(JSON.parse(expected)))
			},
		},
	]
}

export default steps

const parseComment = (step: Step): Options => {
	const settings = new URLSearchParams(
		/retry:([^ ]+)/.exec(step.comment?.text ?? '')?.[1] ?? '',
	)
	const tries = settings.get('tries')
	const factor = settings.get('factor')
	const minDelay = settings.get('minDelay')
	const maxDelay = settings.get('maxDelay')
	const options: Options = {}

	if (tries !== null) options.tries = parseInt(tries, 10)
	if (minDelay !== null) options.minDelay = parseInt(minDelay, 10)
	if (maxDelay !== null) options.maxDelay = parseInt(maxDelay, 10)
	if (factor !== null) options.factor = parseFloat(factor)
	return options
}
