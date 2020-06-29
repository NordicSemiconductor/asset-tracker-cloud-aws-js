import { regexGroupMatcher } from '@bifravst/e2e-bdd-test-runner'
import * as uuid from 'uuid'

export const uuidHelper = regexGroupMatcher(
	/I store a UUIDv4 as "(?<storeName>[^"]+)"/,
)(async ({ storeName }, _, runner) => {
	runner.store[storeName] = uuid.v4()
	return runner.store[storeName]
})
