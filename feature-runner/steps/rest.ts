import {
	codeBlockOrThrow,
	type StepRunner,
	regExpMatchedStep,
	type Logger,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import type { World } from '../run-features.js'
import { matchChoice, matchInteger, matchString } from './util.js'
import { check, objectMatching } from 'tsmatchers'
import { retryCheck } from './retryCheck.js'

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
			progress(`x-amzn-trace-id: ${res.headers.get('x-amzn-trace-id')}`)
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
			async ({ match: { expectedStatus } }) =>
				retryCheck(
					() => check(req?.statusCode()).is(parseInt(expectedStatus, 10)),
					async () => req?.send(),
				),
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
