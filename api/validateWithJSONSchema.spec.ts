import { Static, Type } from '@sinclair/typebox'
import { validateWithJSONSchema } from './validateWithJSONSchema'

const typedInputSchema = Type.Object(
	{
		cell: Type.Number({
			minimum: 1,
		}),
	},
	{ additionalProperties: false },
)

describe('validateWithJSONSchema', () => {
	describe('it should validate', () => {
		const v = validateWithJSONSchema(typedInputSchema)
		it('valid input', () => {
			const isValid = v({ cell: 42 })
			expect('error' in isValid).toEqual(false)
			expect((isValid as Static<typeof typedInputSchema>).cell).toEqual(42)
		})
		it('invalid input', () => {
			const isInvalid = v({ cell: -42 })
			expect('error' in isInvalid).toEqual(true)
		})
	})
})
