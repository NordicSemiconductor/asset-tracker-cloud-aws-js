import { splitMockResponse } from './splitMockResponse.js'

describe('split mock response', () => {
	it('should parse headers and body', () =>
		expect(
			splitMockResponse(`Content-Type: application/octet-stream

(binary A-GPS data) other types`),
		).toMatchObject({
			headers: {
				'Content-Type': 'application/octet-stream',
			},
			body: '(binary A-GPS data) other types',
		}))
})
