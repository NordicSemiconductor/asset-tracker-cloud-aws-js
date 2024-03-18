import {
	codeBlockOrThrow,
	type StepRunner,
	regExpMatchedStep,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features.js'
import { Type } from '@sinclair/typebox'
import { matchChoice, matchInteger, matchString } from './util.js'
import jsonata from 'jsonata'
import {
	check,
	objectMatching,
	objectMatchingStrictly,
	not,
	undefinedValue,
	arrayMatching,
	arrayMatchingStrictly,
} from 'tsmatchers'

const steps: StepRunner<World & Record<string, any>>[] = [
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^${matchString('expression')} should ${matchChoice('matchOrEqual', [
					'match',
					'equal',
				])}$`,
			),
			schema: Type.Object({
				expression: Type.String(),
				matchOrEqual: Type.Union([
					Type.Literal('match'),
					Type.Literal('equal'),
				]),
			}),
		},
		async ({
			match: { expression, matchOrEqual },
			step,
			context,
			log: { progress },
		}) => {
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
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^${matchString('expression')} should equal (?<expected>${matchString(
					'string',
				)}|${matchChoice('boolean', ['true', 'false'])}|${matchInteger(
					'number',
				)})$`,
			),
			schema: Type.Object({
				expression: Type.String(),
				expected: Type.Union([Type.String(), Type.Boolean(), Type.Integer()]),
			}),
		},
		async ({ match: { expression, expected }, context, log: { progress } }) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			if (expected === 'true') expected = true
			if (expected === 'false') expected = false
			if (typeof expected === 'string' && expected.startsWith('`'))
				expected = expected.slice(1, -1)

			progress(`actual: ${JSON.stringify(value)} (${typeof value})`)
			progress(`expected: ${JSON.stringify(expected)} (${typeof expected})`)

			check(value).is(expected)
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I store ${matchString('expression')} into ${matchString(
					'storageName',
				)}$`,
			),
			schema: Type.Object({
				expression: Type.String(),
				storageName: Type.String(),
			}),
		},
		async ({ match: { expression, storageName }, context }) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			check(value).is(not(undefinedValue))

			context[storageName] = value
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I have this JSON-encoded in ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				storageName: Type.String(),
			}),
		},
		async ({ match: { storageName }, step, context }) => {
			context[storageName] = JSON.stringify(
				JSON.stringify(JSON.parse(codeBlockOrThrow(step).code)),
			).slice(1, -1)
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I parse JSON-encoded ${matchString('expression')} into ${matchString(
					'storageName',
				)}$`,
			),
			schema: Type.Object({
				storageName: Type.String(),
				expression: Type.String(),
			}),
		},
		async ({ match: { storageName, expression }, context }) => {
			let e: jsonata.Expression | undefined = undefined
			try {
				e = jsonata(expression)
			} catch {
				throw new Error(`The expression '${expression}' is not valid JSONata.`)
			}

			const value = await e.evaluate(context)

			check(value).is(not(undefinedValue))

			context[storageName] = JSON.parse(new TextDecoder().decode(value))
		},
	),
]
export default steps
