import { extractRepoAndOwner } from './extract-repo-and-owner.js'

describe('extractRepoAndOwner()', () => {
	it('should parse a git repo', () => {
		expect(
			extractRepoAndOwner(
				'git+https://github.com/NordicSemiconductor/asset-tracker-cloud-aws-js.git',
			),
		).toEqual({
			owner: 'NordicSemiconductor',
			repo: 'asset-tracker-cloud-aws-js',
		})
	})
})
