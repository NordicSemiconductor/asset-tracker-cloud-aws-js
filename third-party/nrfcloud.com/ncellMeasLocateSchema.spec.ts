import { Static } from '@sinclair/typebox'
import Ajv from 'ajv'
import { ncellMeasLocateRequestSchema } from './ncellMeasLocateSchema'

const ajv = new Ajv()
// see @https://github.com/sinclairzx81/typebox/issues/51
ajv.addKeyword('kind')
ajv.addKeyword('modifier')

describe('ncellMeasLocateRequestSchema', () => {
	it('should validate a request', () => {
		const v = ajv.compile(ncellMeasLocateRequestSchema)
		const request: Static<typeof ncellMeasLocateRequestSchema> = {
			lte: [
				{
					mcc: 242,
					mnc: 1,
					eci: 1234,
					tac: 1234,
					earfcn: 6446,
					adv: 80,
					rsrp: -97,
					rsrq: -9,
					nmr: [
						{
							earfcn: 262143,
							pci: 501,
							rsrp: -104,
							rsrq: -18,
						},
						{
							earfcn: 262265,
							pci: 503,
							rsrp: -116,
							rsrq: -11,
						},
					],
				},
			],
		}
		const valid = v(request)
		expect(v.errors).toBeNull()
		expect(valid).toEqual(true)
	})
})
