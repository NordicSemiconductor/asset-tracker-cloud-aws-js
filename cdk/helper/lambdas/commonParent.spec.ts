import { commonParent } from './commonParent.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('commonParent()', () => {
	void it('should return the common parent directory', () =>
		assert.equal(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/some/dir/lambda/notifyClients.ts',
				'/some/dir/lambda/wirepasPublish.ts',
				'/some/dir/wirepas-5g-mesh-gateway/protobuf/ts/data_message.ts',
			]),
			'/some/dir/',
		))
	void it('should return the entire parent tree for a single file', () =>
		assert.equal(
			commonParent(['/some/dir/lambda/onMessage.ts']),
			'/some/dir/lambda/',
		))
	void it('should return "/" if files have no common directory', () =>
		assert.equal(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/other/dir/lambda/onMessage.ts',
			]),
			'/',
		))

	void it('should return the common ancestor only up until the directory level', () =>
		assert.equal(
			commonParent([
				'/some/dir/lambdas/cors.ts',
				'/some/dir/lambdas/corsHeaders.ts',
			]),
			'/some/dir/lambdas/',
		))
})
