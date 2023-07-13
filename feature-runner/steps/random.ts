import { type StepRunner } from '@nordicsemiconductor/bdd-markdown'
import type { World } from '../run-features'
import { Type } from '@sinclair/typebox'
import { randomUUID } from 'node:crypto'
import { matchStep, matchString } from './util.js'

const steps: StepRunner<World & Record<string, any>>[] = [
	matchStep(
		new RegExp(`^I have a random email in ${matchString('storageName')}$`),
		Type.Object({
			storageName: Type.String(),
		}),
		async ({ storageName }, { context }) => {
			context[storageName] = `${randomUUID()}@example.com`
			return { result: context[storageName] }
		},
	),
	matchStep(
		new RegExp(`^I have a random password in ${matchString('storageName')}$`),
		Type.Object({
			storageName: Type.String(),
		}),
		async ({ storageName }, { context }) => {
			context[storageName] = ((pw: string) =>
				`${pw[0]?.toUpperCase()}${pw.slice(1)}${Math.round(
					Math.random() * 1000,
				)}`)(
				Math.random()
					.toString(36)
					.replace(/[^a-z]+/g, ''),
			)
			return { result: context[storageName] }
		},
	),
]
export default steps
