import {
	type StepRunner,
	regExpMatchedStep,
} from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { randomUUID } from 'node:crypto'
import { matchChoice, matchString } from './util.js'

const steps: StepRunner<World & Record<string, any>>[] = [
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I have a random email in ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				storageName: Type.String(),
			}),
		},
		async ({ match: { storageName }, context }) => {
			context[storageName] = `${randomUUID()}@example.com`
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I have a random password in ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				storageName: Type.String(),
			}),
		},
		async ({ context, match: { storageName } }) => {
			context[storageName] = ((pw: string) =>
				`${pw[0]?.toUpperCase()}${pw.slice(1)}${Math.round(
					Math.random() * 1000,
				)}`)(
				`${Math.random()
					.toString(36)
					.replace(/[^a-z]+/g, '')}${Math.random()
					.toString(36)
					.replace(/[^a-z]+/g, '')}`,
			)
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I have a random UUID in ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				storageName: Type.String(),
			}),
		},
		async ({ match: { storageName }, context }) => {
			context[storageName] = randomUUID()
		},
	),
	regExpMatchedStep(
		{
			regExp: new RegExp(
				`^I have a random ${matchChoice('type', [
					'number',
					'float',
				])} between ${matchString('min')} and ${matchString(
					'max',
				)} in ${matchString('storageName')}$`,
			),
			schema: Type.Object({
				min: Type.String(),
				max: Type.String(),
				type: Type.Union([Type.Literal('number'), Type.Literal('float')]),
				storageName: Type.String(),
			}),
		},
		async ({
			match: { storageName, min: minString, max: maxString, type },
			context,
		}) => {
			const max = parseInt(maxString, 10)
			const min = parseInt(minString, 10)
			context[storageName] = min + Math.random() * (max - min)
			if (type === 'number')
				context[storageName] = Math.round(context[storageName])
		},
	),
]
export default steps
