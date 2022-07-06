import { Static } from '@sinclair/typebox'
import Ajv from 'ajv'
import { locateRequestSchema } from './locateRequestSchema'

const ajv = new Ajv()
// see @https://github.com/sinclairzx81/typebox/issues/51
ajv.addKeyword('kind')
ajv.addKeyword('modifier')

describe('locateRequestSchema', () => {
	it('should validate a request', () => {
		const v = ajv.compile(locateRequestSchema)
		const request: Static<typeof locateRequestSchema> = {
			lte: [
				{
					eci: 92987688,
					mcc: 242,
					mnc: 1,
					tac: 30401,
				},
			],
		}
		const valid = v(request)
		expect(v.errors).toBeNull()
		expect(valid).toEqual(true)
	})
})
