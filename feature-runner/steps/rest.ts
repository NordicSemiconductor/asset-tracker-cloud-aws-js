import {
	codeBlockOrThrow,
	noMatch,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import type { World } from '../run-features.js'
import { matchChoice, matchStep, matchString } from './util.js'
import { check, objectMatching } from 'tsmatchers'

let res: Response | undefined = undefined

const steps: StepRunner<
	World & {
		response?: {
			body?: string | Record<string, any>
			statusCode: number
			headers: Headers
		}
	}
>[] = [
	matchStep(
		new RegExp(
			`^I ${matchChoice('method', [
				'GET',
				'POST',
				'PUT',
				'DELETE',
			])} (?:to )?${matchString('url')}(?<hasBody> with)?$`,
		),
		Type.Object({
			method: Type.Union([
				Type.Literal('GET'),
				Type.Literal('POST'),
				Type.Literal('PUT'),
				Type.Literal('DELETE'),
			]),
			url: Type.String(),
			hasBody: Type.Optional(Type.Literal(' with')),
		}),
		async (
			{ url: urlString, method, hasBody },
			{
				context,
				step,
				log: {
					step: { progress },
				},
			},
		) => {
			const url = new URL(urlString).toString()
			progress(`${method} ${url}`)
			let body = undefined
			if (hasBody !== undefined) {
				body = codeBlockOrThrow(step).code
				progress(`> ${body}`)
			}

			res = await fetch(url, {
				method,
				body,
				redirect: 'manual',
			})

			progress(`${res.status} ${res.statusText}`)
			let resBody: string | undefined = undefined
			if (parseInt(res.headers.get('content-length') ?? '0', 10) > 0) {
				if (res.headers.get('content-type')?.includes('application/json')) {
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
			return { result: context.response }
		},
	),
	matchStep(
		new RegExp(
			`^the ${matchString('header')} response header should equal ${matchString(
				'expectedValue',
			)}$`,
		),
		Type.Object({
			header: Type.String(),
			expectedValue: Type.String(),
		}),
		async (
			{ header, expectedValue },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const v = context.response?.headers.get(header)
			progress(v ?? '')
			check(v).is(expectedValue)
		},
	),
	matchStep(
		new RegExp(
			`^the response status code should equal ${matchString(
				'expectedStatus',
			)}$`,
		),
		Type.Object({
			expectedStatus: Type.String(),
		}),
		async (
			{ expectedStatus },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const v = context.response?.statusCode
			progress(v?.toString() ?? '')

			check(v).is(parseInt(expectedStatus, 10))
		},
	),
	async ({
		context,
		step,
		log: {
			step: { progress },
		},
	}) => {
		if (!/^the response body should equal$/.test(step.title)) return noMatch

		const { code: expected } = codeBlockOrThrow(step)

		const body = context.response?.body ?? {}
		progress(JSON.stringify(body))

		check(body).is(objectMatching(JSON.parse(expected)))

		return {}
	},
]

export default steps
