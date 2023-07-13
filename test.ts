import { check, objectMatching, objectMatchingStrictly } from 'tsmatchers'

check({
	$metadata: {
		httpStatusCode: 200,
		requestId: '3ec9a8a4-95bb-4fd7-9717-09f6805d6ff2',
		attempts: 1,
		totalRetryDelay: 0,
	},
	UserConfirmed: false,
	UserSub: 'dd3555c6-eb20-463f-bee8-f7b2ac305c40',
}).is(objectMatching({ UserConfirmed: false }))
