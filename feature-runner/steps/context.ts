import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchChoice, matchInteger, matchStep, matchString } from './util.js'
import jsonata from 'jsonata'
import {
	check,
	objectMatching,
	objectMatchingStrictly,
	not,
	undefinedValue,
	arrayMatching,
	arrayMatchingStrictly,
	aString,
	anObject,
} from 'tsmatchers'

const steps: StepRunner<World & Record<string, any>>[] = [
	matchStep(
		new RegExp(
			`^${matchString('expression')} should ${matchChoice('matchOrEqual', [
				'match',
				'equal',
			])}$`,
		),
		Type.Object({
			expression: Type.String(),
			matchOrEqual: Type.Union([Type.Literal('match'), Type.Literal('equal')]),
		}),
		async (
			{ expression, matchOrEqual },
			{
				step,
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			const code = codeBlockOrThrow(step)
			const expected =
				code.language === 'json' ? JSON.parse(code.code) : code.code

			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)
			progress('expected')
			progress(JSON.stringify(expected))
			progress('actual')
			progress(JSON.stringify(value))

			if (matchOrEqual === 'match') {
				if (Array.isArray(expected)) {
					check(value).is(arrayMatching(expected.map((o) => objectMatching(o))))
				} else {
					check(value).is(objectMatching(expected))
				}
			} else {
				if (Array.isArray(expected)) {
					check(value).is(
						arrayMatchingStrictly(
							expected.map((o) => objectMatchingStrictly(o)),
						),
					)
				} else {
					check(value).is(objectMatchingStrictly(expected))
				}
			}
		},
	),
	matchStep(
		new RegExp(
			`^${matchString('expression')} should equal (?<expected>${matchString(
				'string',
			)}|${matchChoice('boolean', ['true', 'false'])}|${matchInteger(
				'number',
			)})$`,
		),
		Type.Object({
			expression: Type.String(),
			expected: Type.Union([Type.String(), Type.Boolean(), Type.Integer()]),
		}),
		async (
			{ expression, expected },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			if (expected === 'true') expected = true
			if (expected === 'false') expected = false
			if (typeof expected === 'string' && expected[0] === '`')
				expected = expected.slice(1, -1)

			progress(`actual: ${JSON.stringify(value)} (${typeof value})`)
			progress(`expected: ${JSON.stringify(expected)} (${typeof expected})`)

			check(value).is(expected)
		},
	),
	matchStep(
		new RegExp(
			`^I store ${matchString('expression')} into ${matchString(
				'storageName',
			)}$`,
		),
		Type.Object({
			expression: Type.String(),
			storageName: Type.String(),
		}),
		async ({ expression, storageName }, { context }) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			check(value).is(not(undefinedValue))

			context[storageName] = value
			return { result: context[storageName] }
		},
	),
	matchStep(
		new RegExp(`^I have this JSON-encoded in ${matchString('storageName')}$`),
		Type.Object({
			storageName: Type.String(),
		}),
		async ({ storageName }, { step, context }) => {
			context[storageName] = JSON.stringify(
				JSON.stringify(JSON.parse(codeBlockOrThrow(step).code)),
			).slice(1, -1)
			return { result: context[storageName] }
		},
	),
	matchStep(
		new RegExp(
			`^I parse JSON-encoded ${matchString('expression')} into ${matchString(
				'storageName',
			)}$`,
		),
		Type.Object({
			storageName: Type.String(),
			expression: Type.String(),
		}),
		async ({ storageName, expression }, { context }) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			check(value).is(not(undefinedValue))

			context[storageName] = JSON.parse(new TextDecoder().decode(value))

			return { result: context[storageName] }
		},
	),
	matchStep(
		new RegExp(
			`^I encode ${matchString('expression')} into ${matchString(
				'storageName',
			)} using ${matchChoice('encoding', [
				'replaceNewLines',
				'base64',
				'JSON',
				'querystring',
			])}$`,
			'',
		),
		Type.Object({
			storageName: Type.String(),
			expression: Type.String(),
			encoding: Type.Union([
				Type.Literal('replaceNewLines'),
				Type.Literal('base64'),
				Type.Literal('JSON'),
				Type.Literal('querystring'),
			]),
		}),
		async (
			{ storageName, expression, encoding },
			{
				context,
				log: {
					step: { progress },
				},
			},
		) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			progress(value)

			switch (encoding) {
				case 'replaceNewLines':
					check(value).is(aString)
					context[storageName] = value.replace(/\n/g, '\\n')
					break
				case 'base64':
					check(value).is(aString)
					context[storageName] = Buffer.from(value).toString('base64')
					break
				case 'JSON':
					check(value).is(anObject)
					context[storageName] = JSON.stringify(value)
					break
				case 'querystring':
					check(value).is(anObject)
					context[storageName] = new URLSearchParams(value).toString()
					break
			}

			return { result: context[storageName] }
		},
	),
]
export default steps
