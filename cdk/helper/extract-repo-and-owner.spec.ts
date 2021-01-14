import { TestRunner } from '../../test-runner'
import { extractRepoAndOwner } from './extract-repo-and-owner.js'
import hamjest from 'hamjest'
const { assertThat, is, equalTo } = hamjest

export const tests = async ({ describe }: TestRunner): Promise<void> => {
	describe('extractRepoAndOwner()', ({ test: it }) => {
		it('should parse a git repo', () => {
			assertThat(
				extractRepoAndOwner('git+https://github.com/bifravst/aws.git'),
				is(
					equalTo({
						owner: 'bifravst',
						repo: 'aws',
					}),
				),
			)
		})
	})
}
