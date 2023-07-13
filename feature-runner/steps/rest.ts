import {
	codeBlockOrThrow,
	matchGroups,
	noMatch,
	type StepRunResult,
	type StepRunner,
	type StepRunnerArgs,
} from '@nordicsemiconductor/bdd-markdown'
import { Type } from '@sinclair/typebox'
import assert from 'assert/strict'
import type { World } from '../run-features'

export const steps = (): StepRunner<
	World & { response?: { body?: string; headers: Headers } }
>[] => {
	let res: Response | undefined = undefined
	return [
		async ({
			step,
			log: {
				step: { progress },
			},
			context,
		}: StepRunnerArgs<
			World & { response?: { body?: string; headers: Headers } }
		>): Promise<StepRunResult> => {
			const match = matchGroups(
				Type.Object({
					method: Type.Union([
						Type.Literal('GET'),
						Type.Literal('POST'),
						Type.Literal('PUT'),
						Type.Literal('DELETE'),
					]),
					endpoint: Type.RegEx(/^https?:\/\/[^/]+/),
					resource: Type.RegEx(/^\/.*/),
					hasBody: Type.Optional(Type.Literal(' with')),
				}),
			)(
				/^I (?<method>(GET|POST|PUT|DELETE)) (?:to )?`(?<endpoint>https?:\/\/[^/]+)(?<resource>\/[^`]*)`(?<hasBody> with)?$/,
				step.title,
			)
			if (match === null) return noMatch
			const url = new URL(match.resource, match.endpoint).toString()
			const method = match.method ?? 'GET'
			progress(`${method} ${url}`)
			let body = undefined
			if (match.hasBody !== undefined) {
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
				resBody = await res.text()
				progress(`< ${resBody}`)
			}
			progress(`x-amzn-trace-id: ${res.headers.get('x-amzn-trace-id')}`)
			context.response = { body: resBody ?? '', headers: res.headers }
		},
		async ({
			step,
		}: StepRunnerArgs<
			World & { response?: { body?: string; headers: Headers } }
		>): Promise<StepRunResult> => {
			const match = matchGroups(
				Type.Object({
					code: Type.RegEx(/^[0-9]+$/),
				}),
			)(/^the response status code should be `(?<code>[0-9]+)`$/, step.title)
			if (match === null) return noMatch

			assert.equal(res?.status, parseInt(match.code, 10))
		},
		async ({
			step,
			context,
		}: StepRunnerArgs<
			World & { response?: { body?: string; headers: Headers } }
		>): Promise<StepRunResult> => {
			const match = matchGroups(
				Type.Object({
					header: Type.String(),
					expected: Type.String(),
				}),
			)(
				/^the response `(?<header>[^`]+)` header should equal `(?<expected>[^`]+)`$/,
				step.title,
			)
			if (match === null) return noMatch

			assert.equal(context.response?.headers.get(match.header), match.expected)
		},
		async ({
			step,
			context,
		}: StepRunnerArgs<
			World & { response?: { body?: string; headers: Headers } }
		>): Promise<StepRunResult> => {
			const match = matchGroups(
				Type.Object({
					regexp: Type.String(),
				}),
			)(
				/^the response body should be a string matching `(?<regexp>[^`]+)`$/,
				step.title,
			)
			if (match === null) return noMatch

			assert.match(context.response?.body ?? '', new RegExp(match.regexp, 'i'))
		},
	]
}
