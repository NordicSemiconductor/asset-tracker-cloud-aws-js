import { commonParent } from './commonParent.js'

describe('commonParent()', () => {
	it('should return the common parent directory', () =>
		expect(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/some/dir/lambda/notifyClients.ts',
				'/some/dir/lambda/wirepasPublish.ts',
				'/some/dir/wirepas-5g-mesh-gateway/protobuf/ts/data_message.ts',
			]),
		).toEqual('/some/dir/'))
	it('should return the entire parent tree for a single file', () =>
		expect(commonParent(['/some/dir/lambda/onMessage.ts'])).toEqual(
			'/some/dir/lambda/',
		))
	it('should return "/" if files have no common directory', () =>
		expect(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/other/dir/lambda/onMessage.ts',
			]),
		).toEqual('/'))
})
