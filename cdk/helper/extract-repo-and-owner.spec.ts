import { extractRepoAndOwner } from './extract-repo-and-owner'

describe('extractRepoAndOwner()', () => {
	it('should parse a git repo', () => {
		expect(
			extractRepoAndOwner('git+https://github.com/bifravst/aws.git'),
		).toEqual({
			owner: 'bifravst',
			repo: 'aws',
		})
	})
})
