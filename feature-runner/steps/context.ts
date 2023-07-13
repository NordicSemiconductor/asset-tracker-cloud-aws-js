import {
	codeBlockOrThrow,
	type StepRunner,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { matchChoice, matchStep, matchString } from './util.js'
import jsonata from 'jsonata'
import { check, objectMatching, objectMatchingStrictly } from 'tsmatchers'

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
			progress(value)

			if (matchOrEqual === 'match') {
				check(value).is(objectMatching(expected))
			} else {
				check(value).is(objectMatchingStrictly(expected))
			}
		},
	),
]
export default steps
