import { Static, Type } from '@sinclair/typebox'
import { isRight, Right } from 'fp-ts/lib/Either'
import { isLeft } from 'fp-ts/lib/These'
import { validateWithJSONSchemaFP } from './validateWithJSONSchemaFP.js'

const typedInputSchema = Type.Object(
	{
		cell: Type.Number({
			minimum: 1,
		}),
	},
	{ additionalProperties: false },
)

describe('validateWithJSONSchemaFP', () => {
	describe('it should validate', () => {
		const v = validateWithJSONSchemaFP(typedInputSchema)
		it('valid input', () => {
			const isValid = v({ cell: 42 })
			expect(isRight(isValid)).toEqual(true)
			expect(
				(isValid as Right<Static<typeof typedInputSchema>>).right.cell,
			).toEqual(42)
		})
		it('invalid input', () => {
			const isInvalid = v({ cell: -42 })
			expect(isLeft(isInvalid)).toEqual(true)
		})
	})
})
