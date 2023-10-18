import { extractRepoAndOwner } from './extract-repo-and-owner.js'
import { describe, it } from 'node:test'
import assert from 'node:assert'

void describe('extractRepoAndOwner()', () => {
	void it('should parse a git repo', () => {
		assert.deepEqual(
			extractRepoAndOwner(
				'git+https://github.com/NordicSemiconductor/asset-tracker-cloud-aws-js.git',
			),
			{
				owner: 'NordicSemiconductor',
				repo: 'asset-tracker-cloud-aws-js',
			},
		)
	})
})
